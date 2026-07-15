import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getGame } from "@/lib/games";
import {
  TOP_N,
  leaderboardMetaKey,
  leaderboardScoreKey,
  msUntilNextUtcMidnight,
  utcDayKey,
} from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type MetaEntry = { name: string; score: number; timestamp: number };
type MetaRecord = Record<string, MetaEntry | string>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const game = getGame(searchParams.get("game") ?? "");
  if (!game) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }

  const day = utcDayKey();
  const scoreKey = leaderboardScoreKey(game.slug, day);
  const metaKey = leaderboardMetaKey(game.slug, day);

  const raw = await redis.zrange<(string | number)[]>(scoreKey, 0, TOP_N - 1, {
    rev: true,
    withScores: true,
  });

  const members: string[] = [];
  const scores: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    members.push(String(raw[i]));
    scores.push(Number(raw[i + 1]));
  }

  const meta = members.length
    ? ((await redis.hmget(metaKey, ...members)) as MetaRecord | null)
    : null;

  const players = members.map((member, i) => {
    const entry = meta?.[member];
    const parsed = typeof entry === "string" ? safeParse(entry) : entry;
    return {
      rank: i + 1,
      name: parsed?.name ?? "anonymous",
      score: scores[i],
      timestamp: parsed?.timestamp ?? null,
    };
  });

  return NextResponse.json({
    game: game.slug,
    day,
    resetsInMs: msUntilNextUtcMidnight(),
    players,
  });
}

function safeParse(value: string): MetaEntry | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
