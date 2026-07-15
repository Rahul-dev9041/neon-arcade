import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  SESSION_COOKIE,
  emailKey,
  getSessionUser,
  sessionCookieOptions,
  userKey,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Permanent account deletion (GDPR-style right to erasure). Removes the
 * account record, the email index, every live session, and the player's
 * entries on every leaderboard — across BOTH arcade sites, since they share
 * the account namespace. Password re-confirmation stops a hijacked session
 * (or a prankster at an unlocked screen) from destroying the account.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (
    typeof body.password !== "string" ||
    !(await verifyPassword(body.password, user.passwordHash))
  ) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const usernameLower = user.username.toLowerCase();

  // Scrub every leaderboard (all games, all days, both sites).
  for (const pattern of ["arcade:lb:*", "snakefree:leaderboard:*"]) {
    const keys = await redis.keys(pattern);
    for (const key of keys) {
      if (key.endsWith(":meta")) await redis.hdel(key, usernameLower);
      else await redis.zrem(key, usernameLower);
    }
  }

  // Revoke every live session belonging to this account.
  const sessionKeys = await redis.keys("snakefree:session:*");
  for (const key of sessionKeys) {
    const owner = await redis.get<string>(key);
    if (owner === usernameLower) await redis.del(key);
  }

  // Finally the account itself and its email index.
  await redis.del(userKey(usernameLower), emailKey(user.email.toLowerCase()));

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
