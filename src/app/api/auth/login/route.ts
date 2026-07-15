import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  MAX_PASSWORD_LENGTH,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  dummyVerify,
  emailKey,
  sessionCookieOptions,
  userKey,
  verifyPassword,
  type UserRecord,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

type LoginBody = { identifier?: string; password?: string };

const MAX_ATTEMPTS_PER_IDENTIFIER = 10;
const MAX_ATTEMPTS_PER_IP = 30;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;
// Short-window burst cap: the 15-minute windows above still allowed 30
// rapid-fire guesses; this holds the floor at ~8/minute per IP.
const MAX_ATTEMPTS_PER_IP_PER_MINUTE = 8;

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const identifier =
    typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return NextResponse.json({ error: "Missing username/email or password." }, { status: 400 });
  }
  // Length caps keep hostile inputs from becoming oversized Redis keys or
  // needlessly expensive scrypt runs.
  if (identifier.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Incorrect username/email or password." }, { status: 401 });
  }

  // Two brute-force dampers: per-identifier (protects one account from a
  // distributed attack) and per-IP (stops one machine spraying guesses
  // across many identifiers).
  const ip = await clientIp();
  const [identifierOk, ipOk, burstOk] = await Promise.all([
    rateLimit(`login:id:${identifier}`, MAX_ATTEMPTS_PER_IDENTIFIER, ATTEMPT_WINDOW_SECONDS),
    rateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, ATTEMPT_WINDOW_SECONDS),
    rateLimit(`login:burst:${ip}`, MAX_ATTEMPTS_PER_IP_PER_MINUTE, 60),
  ]);
  if (!identifierOk || !ipOk || !burstOk) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  // Accept either username or email as the identifier.
  const usernameLower = identifier.includes("@")
    ? await redis.get<string>(emailKey(identifier))
    : identifier;

  const raw = usernameLower
    ? await redis.get<UserRecord | string>(userKey(usernameLower))
    : null;
  const user = typeof raw === "string" ? safeParseUser(raw) : raw;

  // Same error AND the same scrypt cost for unknown-account and
  // wrong-password — neither the response body nor its latency reveals
  // whether an account exists.
  if (!user) {
    await dummyVerify(password);
    return NextResponse.json({ error: "Incorrect username/email or password." }, { status: 401 });
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect username/email or password." }, { status: 401 });
  }

  await redis.del(`snakefree:ratelimit:login:id:${identifier}`);
  const token = await createSession(user.username.toLowerCase());
  const res = NextResponse.json({
    ok: true,
    user: { username: user.username, email: user.email },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_TTL_SECONDS));
  return res;
}

function safeParseUser(value: string): UserRecord | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
