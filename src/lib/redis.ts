import { Redis } from "@upstash/redis";

/**
 * Accepts either the Vercel KV env var names (set when provisioning via
 * `vercel integration add upstash/upstash-kv`) or Upstash's own
 * `UPSTASH_REDIS_REST_*` names (set when copying credentials from the
 * Upstash console directly).
 */
export const redis = new Redis({
  url: (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)!,
  token: (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)!,
});
