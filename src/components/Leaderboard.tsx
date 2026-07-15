"use client";

import { useEffect, useState } from "react";

type Player = {
  rank: number;
  name: string;
  score: number;
  timestamp: number | null;
};

type DailyResponse = {
  game: string;
  day: string;
  resetsInMs: number;
  players: Player[];
};

const RANK_STYLE: Record<number, { glow: string; text: string; label: string }> = {
  1: { glow: "0 0 10px rgba(255,215,0,0.6), 0 0 26px rgba(255,215,0,0.28)", text: "#ffd700", label: "1st" },
  2: { glow: "0 0 10px rgba(192,192,192,0.55), 0 0 24px rgba(192,192,192,0.22)", text: "#c9c9d6", label: "2nd" },
  3: { glow: "0 0 10px rgba(205,127,50,0.55), 0 0 24px rgba(205,127,50,0.22)", text: "#cd7f32", label: "3rd" },
};

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function Leaderboard({ game }: { game: string }) {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [msRemaining, setMsRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/leaderboard/daily?game=${game}`, { cache: "no-store" });
        if (!res.ok) return;
        const json: DailyResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setMsRemaining(json.resetsInMs);
        }
      } catch {
        // transient fetch failure — the panel just keeps showing stale data
      }
    }

    load();
    const poll = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [game]);

  useEffect(() => {
    if (msRemaining === null) return;
    const tick = setInterval(() => {
      setMsRemaining((prev) => (prev === null ? null : Math.max(0, prev - 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [msRemaining === null]);

  const players = data?.players ?? [];
  const podium = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className="glass-panel neon-border-green p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="terminal-label">Daily Leaderboard</span>
        <span className="terminal-label">
          resets in{" "}
          <span className="neon-text-cyan">
            {msRemaining === null ? "···" : formatCountdown(msRemaining)}
          </span>
        </span>
      </div>

      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {podium.map((player) => {
            const style = RANK_STYLE[player.rank];
            return (
              <div
                key={`${player.rank}-${player.name}`}
                className="glass-panel p-3 flex flex-col items-center gap-1 text-center"
                style={{ border: `1px solid ${style.text}`, boxShadow: style.glow }}
              >
                <span className="terminal-label" style={{ color: style.text }}>
                  {style.label}
                </span>
                <span
                  className="text-xs max-w-full truncate"
                  style={{ color: style.text, textShadow: style.glow }}
                >
                  {player.name}
                </span>
                <span className="text-lg font-bold" style={{ color: style.text }}>
                  {player.score}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {rest.map((player) => (
            <div
              key={`${player.rank}-${player.name}`}
              className="flex items-center justify-between gap-2 text-xs px-2 py-1.5"
              style={{ borderBottom: "1px solid var(--glass-border)" }}
            >
              <span className="terminal-label">#{player.rank}</span>
              <span className="truncate" style={{ color: "var(--ink)" }}>
                {player.name}
              </span>
              <span className="neon-text-green font-bold">{player.score}</span>
            </div>
          ))}
        </div>
      )}

      {players.length === 0 && (
        <p className="terminal-label text-center">no runs submitted today · be the first</p>
      )}
    </div>
  );
}
