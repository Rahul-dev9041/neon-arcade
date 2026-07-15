import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { GAMES } from "@/lib/games";
import { leaderboardMetaKey, leaderboardScoreKey, utcDayKey } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

/** Today's #1 for every game — powers the hub tiles' teasers in one call. */
export async function GET() {
  const day = utcDayKey();

  const tops = await Promise.all(
    GAMES.map(async (game) => {
      const raw = await redis.zrange<(string | number)[]>(
        leaderboardScoreKey(game.slug, day),
        0,
        0,
        { rev: true, withScores: true },
      );
      if (raw.length < 2) return { game: game.slug, top: null };

      const member = String(raw[0]);
      const score = Number(raw[1]);
      const entry = await redis.hget<{ name: string } | string>(
        leaderboardMetaKey(game.slug, day),
        member,
      );
      const parsed = typeof entry === "string" ? safeParse(entry) : entry;
      return { game: game.slug, top: { name: parsed?.name ?? "anonymous", score } };
    }),
  );

  return NextResponse.json({ day, tops });
}

function safeParse(value: string): { name: string } | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
