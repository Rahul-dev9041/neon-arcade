/** Shared between the client and the API routes — keep isomorphic. */

export const TOP_N = 100;

/** Run tokens expire after this — no legitimate single run lasts longer. */
export const RUN_TOKEN_TTL_SECONDS = 60 * 60;

/** UTC calendar day, e.g. "2026-07-05" — leaderboards reset whenever this rolls over. */
export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function msUntilNextUtcMidnight(date = new Date()): number {
  const next = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
  return next.getTime() - date.getTime();
}

/** Per-game daily sorted set. */
export function leaderboardScoreKey(game: string, day: string): string {
  return `arcade:lb:${game}:${day}`;
}

export function leaderboardMetaKey(game: string, day: string): string {
  return `arcade:lb:${game}:${day}:meta`;
}

/**
 * Server-issued run tokens: the API records {game, username, startedAt}
 * when a run starts, and score submission requires an unused token whose
 * server-side start time makes the claimed score physically achievable for
 * that game. The client never supplies its own start time or identity.
 */
export function runTokenKey(token: string): string {
  return `arcade:run:${token}`;
}
