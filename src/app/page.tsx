"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/games";
import { useAuth } from "@/lib/useAuth";

type Tops = Record<string, { name: string; score: number } | null>;

export default function Hub() {
  const { user } = useAuth();
  const [tops, setTops] = useState<Tops>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/leaderboard/tops", { cache: "no-store" });
        if (!res.ok) return;
        const json: { tops: { game: string; top: Tops[string] }[] } = await res.json();
        if (!cancelled) {
          setTops(Object.fromEntries(json.tops.map((t) => [t.game, t.top])));
        }
      } catch {
        // teasers are decorative — tiles work without them
      }
    }
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl md:text-4xl font-bold tracking-widest neon-text-green">
          NEON ARCADE
        </h1>
        <p className="terminal-label">
          five games · one account · daily leaderboards · top 3 celebrate
        </p>
        {user && (
          <p className="terminal-label">
            player: <span className="neon-text-cyan">{user.username}</span>
          </p>
        )}
      </header>

      <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {GAMES.map((game) => {
          const top = tops[game.slug];
          return (
            <Link
              key={game.slug}
              href={`/${game.slug}`}
              className="glass-panel p-5 flex flex-col gap-3 transition-transform hover:scale-[1.02]"
              style={{
                textDecoration: "none",
                border: `1px solid ${game.color}44`,
                boxShadow: `0 0 18px ${game.color}22`,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-lg font-bold tracking-widest"
                  style={{ color: game.color, textShadow: `0 0 12px ${game.color}` }}
                >
                  {game.name.toUpperCase()}
                </span>
                <span className="text-xl" style={{ color: game.color }}>
                  ▶
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
                {game.tagline}
              </p>
              <p className="terminal-label mt-auto">
                {top ? (
                  <>
                    today&apos;s best:{" "}
                    <span style={{ color: game.color }}>
                      {top.name} · {top.score}
                    </span>
                  </>
                ) : (
                  "no runs today · claim the crown"
                )}
              </p>
            </Link>
          );
        })}

        <div
          className="glass-panel p-5 flex flex-col items-center justify-center gap-2 text-center"
          style={{ border: "1px dashed var(--glass-border)", minHeight: 120 }}
        >
          <span className="terminal-label">more games incoming</span>
          <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
            the grid keeps growing
          </span>
        </div>
      </main>

      <footer className="terminal-label text-center">
        free forever · no ads · no downloads
      </footer>
    </div>
  );
}
