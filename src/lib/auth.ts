import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCb,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { redis } from "@/lib/redis";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
  options?: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export const SESSION_COOKIE = "snake_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// Versioned scrypt parameters. N=32768/r=8/p=1 (32 MiB) is deliberately
// above Node's default cost; maxmem must be raised accordingly or scrypt
// throws. Bump these by adding a new version prefix — verifyPassword reads
// the parameters out of each stored hash, so old hashes keep verifying.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

export type UserRecord = {
  username: string; // display casing as chosen at signup
  email: string;
  passwordHash: string; // versioned scrypt string — plaintext is never stored
  createdAt: number;
};

export function userKey(usernameLower: string): string {
  return `snakefree:user:${usernameLower}`;
}

export function emailKey(emailLower: string): string {
  return `snakefree:email:${emailLower}`;
}

/**
 * Sessions are stored under the SHA-256 of the cookie token, so a leaked
 * Redis snapshot contains nothing that can be replayed as a cookie.
 */
export function sessionKey(rawToken: string): string {
  const digest = createHash("sha256").update(rawToken).digest("hex");
  return `snakefree:session:${digest}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `s2:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  let salt: string;
  let hashHex: string;
  let params: { N: number; r: number; p: number; maxmem: number };

  const parts = stored.split(":");
  if (parts[0] === "s2" && parts.length === 6) {
    const [, n, r, p, s, h] = parts;
    params = { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT_MAXMEM };
    salt = s;
    hashHex = h;
  } else if (parts.length === 2) {
    // Legacy format from before parameter versioning: Node's scrypt defaults.
    params = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
    [salt, hashHex] = parts;
  } else {
    return false;
  }

  if (!salt || !hashHex || !Number.isFinite(params.N)) return false;
  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, SCRYPT_KEYLEN, params);
  } catch {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Burns the same scrypt work as a real verification. Called when the account
 * doesn't exist so "unknown user" and "wrong password" take the same time —
 * otherwise response latency would reveal which usernames are registered.
 */
export async function dummyVerify(password: string): Promise<void> {
  await verifyPassword(
    password,
    `s2:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:0123456789abcdef0123456789abcdef:${"00".repeat(SCRYPT_KEYLEN)}`,
  );
}

export async function createSession(usernameLower: string): Promise<string> {
  const token = randomUUID();
  await redis.set(sessionKey(token), usernameLower, { ex: SESSION_TTL_SECONDS });
  return token;
}

/** Resolves the logged-in user from the request's session cookie, or null. */
export async function getSessionUser(): Promise<UserRecord | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const usernameLower = await redis.get<string>(sessionKey(token));
  if (!usernameLower) return null;
  const user = await redis.get<UserRecord | string>(userKey(usernameLower));
  if (!user) return null;
  return typeof user === "string" ? safeParseUser(user) : user;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function safeParseUser(value: string): UserRecord | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
