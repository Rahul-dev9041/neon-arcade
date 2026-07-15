"use client";

import { useCallback, useState, type ComponentType } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { Celebration } from "@/components/Celebration";
import { useAuth } from "@/lib/useAuth";
import { useSubmitScore } from "@/lib/useSubmitScore";
import type { GameDef } from "@/lib/games";
import type { GameProps } from "@/components/games/types";

/**
 * The shared shell every game page mounts: auth, run tokens, score
 * submission, per-game leaderboard, and top-3 celebrations. A game only has
 * to implement the GameProps contract.
 */
export function GamePage({
  game,
  GameComponent,
}: {
  game: GameDef;
  GameComponent: ComponentType<GameProps>;
}) {
  const { user, isLoading, signup, login, logout } = useAuth();
  const { submitScore } = useSubmitScore(game.slug);
  const [celebration, setCelebration] = useState<{ rank: number; score: number } | null>(null);

  const handleStart = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/run/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: game.slug }),
      });
      if (!res.ok) return null;
      const json: { runToken?: string } = await res.json();
      return json.runToken ?? null;
    } catch {
      return null;
    }
  }, [game.slug]);

  const handleGameOver = useCallback(
    async (finalScore: number, runToken: string | null) => {
      if (!runToken) return;
      const result = await submitScore(finalScore, runToken);
      // Celebrate only when THIS run earned a podium spot.
      if (result?.updated && result.rank !== null && result.rank <= 3) {
        setCelebration({ rank: result.rank, score: finalScore });
      }
    },
    [submitScore],
  );

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-8">
      <header className="w-full max-w-3xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/" className="terminal-label" style={{ textDecoration: "none" }}>
            ← arcade
          </Link>
          <h1
            className="text-base md:text-lg font-bold tracking-widest"
            style={{ color: game.color, textShadow: `0 0 12px ${game.color}` }}
          >
            {game.name.toUpperCase()}
          </h1>
        </div>
        {user && (
          <span className="terminal-label">
            player: <span className="neon-text-cyan">{user.username}</span>
          </span>
        )}
      </header>

      <main className="game-layout max-w-3xl">
        <div className="game-layout-game">
          <GameComponent
            canPlay={Boolean(user)}
            onStart={handleStart}
            onGameOver={handleGameOver}
          />
        </div>
        <div className="game-layout-rail">
          <AuthPanel
            user={user}
            isLoading={isLoading}
            onSignup={signup}
            onLogin={login}
            onLogout={logout}
          />
          <Leaderboard game={game.slug} />
        </div>
      </main>

      {celebration && (
        <Celebration
          rank={celebration.rank}
          score={celebration.score}
          onClose={() => setCelebration(null)}
        />
      )}

      <footer className="terminal-label">{game.controls}</footer>
    </div>
  );
}
