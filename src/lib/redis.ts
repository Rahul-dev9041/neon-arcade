import { Redis } from "@upstash/redis";

/**
 * Accepts either the Vercel KV env var names (set when provisioning via
 * `vercel integration add upstash/upstash-kv`) or Upstash's own
 * `UPSTASH_REDIS_REST_*` names.
 *
 * The client is created lazily on first use so `next build` succeeds without
 * credentials, but any actual request fails immediately with a clear message
 * instead of the SDK's silent misconfigured-client behavior.
 */
let client: Redis | undefined;

function createClient(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Redis credentials are not configured. Set KV_REST_API_URL and " +
        "KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) " +
        "— see .env.example.",
    );
  }
  return new Redis({ url, token });
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    client ??= createClient();
    const value = client[prop as keyof Redis];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
