/**
 * Shared between the client game loop and the server-side leaderboard
 * validator — keep isomorphic (no DOM/canvas APIs here).
 */

export const GRID_SIZE = 20;
export const INITIAL_SNAKE_LENGTH = 3;

/**
 * Progressive speed: runs start gentle and accelerate as the score grows
 * (classic arcade pacing — the flat 110ms tick felt too fast off the line).
 * Reaches top speed at score 20.
 */
export const TICK_START_MS = 150;
export const TICK_MIN_MS = 110;
export const TICK_STEP_MS = 2;

export function tickMsForScore(score: number): number {
  return Math.max(TICK_MIN_MS, TICK_START_MS - score * TICK_STEP_MS);
}

/**
 * A run can never score higher than filling every cell on the board that
 * doesn't start occupied by the snake — this is a hard ceiling on what the
 * actual game can produce, unlike an arbitrary round-number cap.
 */
export const MAX_POSSIBLE_SCORE = GRID_SIZE * GRID_SIZE - INITIAL_SNAKE_LENGTH;
