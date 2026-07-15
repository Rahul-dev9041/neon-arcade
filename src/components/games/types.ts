/** Contract every arcade game component implements. */
export type GameProps = {
  canPlay: boolean;
  /**
   * Requests a single-use run token from the server; resolves null on
   * failure. Games must only start a run on a non-null result — a tokenless
   * run's score could never be submitted.
   */
  onStart: () => Promise<string | null>;
  onGameOver: (finalScore: number, runToken: string | null) => void;
};
