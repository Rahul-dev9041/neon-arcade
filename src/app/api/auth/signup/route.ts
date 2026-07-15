import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  EMAIL_RE,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  USERNAME_RE,
  createSession,
  emailKey,
  hashPassword,
  sessionCookieOptions,
  userKey,
  type UserRecord,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

type SignupBody = { username?: string; email?: string; password?: string };

const MAX_SIGNUPS_PER_IP = 5;
const SIGNUP_WINDOW_SECONDS = 60 * 60;

export async function POST(request: Request) {
  // Caps account creation per IP so a bot can't mass-register and bloat
  // Redis. Checked before any validation so failures also count.
  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, MAX_SIGNUPS_PER_IP, SIGNUP_WINDOW_SECONDS))) {
    return NextResponse.json(
      { error: "Too many accounts created from this network. Try again later." },
      { status: 429 },
    );
  }

  let body: SignupBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 characters: letters, numbers, _ or -." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  // Upper bound stops megabyte "passwords" from turning scrypt into a DoS lever.
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const usernameLower = username.toLowerCase();
  const record: UserRecord = {
    username,
    email,
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
  };

  // NX writes make signup race-safe: claim the email first, then the
  // username, releasing the email claim if the username turns out taken.
  const emailClaimed = await redis.set(emailKey(email), usernameLower, { nx: true });
  if (!emailClaimed) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }
  const userClaimed = await redis.set(userKey(usernameLower), JSON.stringify(record), {
    nx: true,
  });
  if (!userClaimed) {
    await redis.del(emailKey(email));
    return NextResponse.json({ error: "This username is already taken." }, { status: 409 });
  }

  const token = await createSession(usernameLower);
  const res = NextResponse.json({ ok: true, user: { username, email } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_TTL_SECONDS));
  return res;
}
