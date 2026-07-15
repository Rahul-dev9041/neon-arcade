"use client";

import { useCallback, useState } from "react";

type SubmitState = "idle" | "submitting" | "done" | "error";

export type SubmitResult = {
  updated: boolean;
  bestScore: number;
  rank: number | null;
};

export function useSubmitScore(game: string) {
  const [state, setState] = useState<SubmitState>("idle");

  const submitScore = useCallback(
    async (score: number, runToken: string): Promise<SubmitResult | null> => {
      if (score <= 0) return null;

      setState("submitting");
      try {
        const res = await fetch("/api/leaderboard/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game, score, runToken }),
        });
        if (!res.ok) throw new Error(await res.text());
        const json: SubmitResult = await res.json();
        setState("done");
        return json;
      } catch {
        // A rejected submission just means the run's score never hits the
        // board — the player already saw their score in-game.
        setState("error");
        return null;
      }
    },
    [game],
  );

  return { submitScore, state };
}
