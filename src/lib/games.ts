/**
 * The game registry — single source of truth for every game in the arcade.
 * Adding a game = one entry here + a component in components/games/ + a
 * page in app/<slug>/. The API routes validate against this registry, so a
 * forged request can't invent a game or bypass a game's plausibility rules.
 */

export type GameDef = {
  slug: string;
  name: string;
  tagline: string;
  /** Accent color for the hub tile + game chrome. */
  color: string;
  /** How to play, shown on the game page. */
  controls: string;
  /**
   * Hard ceiling on a legitimate score — tied to each game's actual
   * mechanics, not a round number.
   */
  maxPlausibleScore: number;
  /**
   * Minimum real-world ms a legitimate point can take, anchored to each
   * game's fastest possible scoring rate. The submit API rejects scores
   * that outpace this against the server-recorded run start time.
   */
  minMsPerPoint: number;
};

export const GAMES: GameDef[] = [
  {
    slug: "snake",
    name: "Snake",
    tagline: "the classic, in neon",
    color: "#39ff9c",
    controls: "arrows / WASD · swipe · d-pad",
    // 20×20 grid minus starting length; fastest tick is 110ms.
    maxPlausibleScore: 397,
    minMsPerPoint: 55,
  },
  {
    slug: "glide",
    name: "Glide",
    tagline: "one tap · don't touch anything",
    color: "#35e5ff",
    controls: "tap / click / space to flap",
    // One point per gate; gates arrive at most ~every 900ms at top speed.
    maxPlausibleScore: 999,
    minMsPerPoint: 450,
  },
  {
    slug: "blocks",
    name: "Blocks",
    tagline: "merge to 2048 and beyond",
    color: "#ffd700",
    controls: "arrows / WASD · swipe",
    // Perfect play on a 4×4 board tops out well under this.
    maxPlausibleScore: 250000,
    minMsPerPoint: 4,
  },
  {
    slug: "reflex",
    name: "Reflex",
    tagline: "stop the bar · dead center",
    color: "#ff5ea8",
    controls: "tap / click / space to stop",
    // One point per round; a round's sweep can't finish faster than ~350ms.
    maxPlausibleScore: 200,
    minMsPerPoint: 300,
  },
  {
    slug: "bricks",
    name: "Bricks",
    tagline: "smash every last one",
    color: "#a78bfa",
    controls: "mouse / touch / arrows to move the paddle",
    // One point per brick; ball physics can't break bricks faster than this.
    maxPlausibleScore: 2000,
    minMsPerPoint: 90,
  },
];

export function getGame(slug: string): GameDef | undefined {
  return GAMES.find((g) => g.slug === slug);
}
