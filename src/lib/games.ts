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
  {
    slug: "stax",
    name: "Stax",
    tagline: "stack falling blocks · clear lines",
    color: "#f43f5e",
    controls: "arrows to move / rotate · space to drop · on-screen pad",
    // Line points (100–800 per clear); even perfect play can't out-earn this.
    maxPlausibleScore: 200000,
    minMsPerPoint: 6,
  },
  {
    slug: "pop",
    name: "Pop",
    tagline: "aim · shoot · burst the bubbles",
    color: "#22d3ee",
    controls: "aim with pointer · tap / click to shoot",
    // Points per popped/dropped bubble; a shot resolves at most ~once a second.
    maxPlausibleScore: 5000,
    minMsPerPoint: 25,
  },
  {
    slug: "mines",
    name: "Mines",
    tagline: "sweep the grid · don't click the boom",
    color: "#fb923c",
    controls: "tap to reveal · flag mode for marking mines",
    // One point per safe cell; flood fills reveal many cells per click.
    maxPlausibleScore: 3000,
    minMsPerPoint: 4,
  },
  {
    slug: "tictactoe",
    name: "Tic-Tac-Toe",
    tagline: "beat the machine · streak it",
    color: "#5eead4",
    controls: "tap a cell — X is you, streak wins vs the AI",
    // One point per win; a win needs at least five alternating moves.
    maxPlausibleScore: 100,
    minMsPerPoint: 1200,
  },
  {
    slug: "boxes",
    name: "Dots & Boxes",
    tagline: "close boxes · out-draw the AI",
    color: "#eab308",
    controls: "tap an edge to draw it — complete a box for another turn",
    // One point per captured box; every box needs at least one deliberate move.
    maxPlausibleScore: 600,
    minMsPerPoint: 200,
  },
  {
    slug: "echo",
    name: "Echo",
    tagline: "watch · listen · repeat the pattern",
    color: "#e879f9",
    controls: "tap the pads in the order they light up",
    // One point per round; round n replays an n-step sequence first.
    maxPlausibleScore: 150,
    minMsPerPoint: 350,
  },
];

export function getGame(slug: string): GameDef | undefined {
  return GAMES.find((g) => g.slug === slug);
}
