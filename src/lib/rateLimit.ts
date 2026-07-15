import { headers } from "next/headers";
import { redis } from "@/lib/redis";

/**
 * Fixed-window rate limiter: INCR + EXPIRE on first hit. Returns true while
 * the caller is within `max` events per `windowSeconds`.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const fullKey = `snakefree:ratelimit:${key}`;
  const count = await redis.incr(fullKey);
  if (count === 1) await redis.expire(fullKey, windowSeconds);
  return count <= max;
}

/**
 * Client IP as seen by Vercel's proxy. `x-forwarded-for`'s first entry is
 * set by the platform (not spoofable by the client on Vercel, which
 * overwrites rather than appends to inbound values).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
