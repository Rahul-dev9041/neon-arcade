"use client";

/**
 * Shared start / game-over overlay used by every game's stage. Rendered
 * inside the game's relatively-positioned stage container.
 */
export function Overlay({
  status,
  score,
  canPlay,
  onStart,
  readyHint,
}: {
  status: "idle" | "starting" | "running" | "over";
  score: number;
  canPlay: boolean;
  onStart: () => void;
  readyHint: string;
}) {
  if (status === "running") return null;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4"
      style={{ background: "rgba(5, 6, 10, 0.82)" }}
    >
      {status === "starting" ? (
        <p className="neon-text-cyan text-sm terminal-label">entering the grid…</p>
      ) : status === "over" ? (
        <>
          <p className="neon-text-green text-base md:text-lg font-bold">GAME OVER</p>
          <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
            final score: {score}
          </p>
          {canPlay ? (
            <button className="btn-neon mt-2" onClick={onStart}>
              Play Again
            </button>
          ) : (
            <p className="terminal-label mt-2">sign in to keep playing</p>
          )}
        </>
      ) : !canPlay ? (
        <>
          <p className="neon-text-cyan text-sm terminal-label">sign in to play</p>
          <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
            create a free account to enter the grid
          </p>
        </>
      ) : (
        <>
          <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
            {readyHint}
          </p>
          <button className="btn-neon" onClick={onStart}>
            Start Run
          </button>
        </>
      )}
    </div>
  );
}
