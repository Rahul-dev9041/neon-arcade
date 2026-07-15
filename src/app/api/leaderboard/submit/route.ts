import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getSessionUser } from "@/lib/auth";
import { getGame } from "@/lib/games";
import {
  leaderboardMetaKey,
  leaderboardScoreKey,
  runTokenKey,
  utcDayKey,
} from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type SubmitBody = {
  game?: string;
  score?: number;
  runToken?: string;
};

type RunTokenRecord = { game: string; startedAt: number; username: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // Identity comes from the session cookie, never from the request body.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to submit a score." }, { status: 401 });
  }
  const usernameLower = user.username.toLowerCase();

  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { score, runToken } = body;
  const game = typeof body.game === "string" ? getGame(body.game) : undefined;

  if (!game) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }
  if (typeof score !== "number" || !Number.isInteger(score) || score <= 0) {
    return NextResponse.json({ error: "Invalid score." }, { status: 400 });
  }
  if (score > game.maxPlausibleScore) {
    return NextResponse.json(
      { error: "Score exceeds this game's maximum possible score." },
      { status: 400 },
    );
  }
  if (typeof runToken !== "string" || !UUID_RE.test(runToken)) {
    return NextResponse.json({ error: "Missing or invalid run token." }, { status: 400 });
  }

  // Single-use consumption (atomic getdel) + account and game binding +
  // per-game elapsed-time plausibility, all anchored to server state.
  const tokenRecord = await redis.getdel<RunTokenRecord | string>(runTokenKey(runToken));
  if (!tokenRecord) {
    return NextResponse.json(
      { error: "Run token not found, expired, or already claimed." },
      { status: 409 },
    );
  }
  const parsed = typeof tokenRecord === "string" ? safeParse(tokenRecord) : tokenRecord;
  if (
    typeof parsed?.startedAt !== "number" ||
    typeof parsed?.username !== "string" ||
    typeof parsed?.game !== "string"
  ) {
    return NextResponse.json({ error: "Corrupt run token." }, { status: 400 });
  }
  if (parsed.username !== usernameLower) {
    return NextResponse.json(
      { error: "Run token belongs to a different account." },
      { status: 403 },
    );
  }
  if (parsed.game !== game.slug) {
    return NextResponse.json(
      { error: "Run token belongs to a different game." },
      { status: 400 },
    );
  }
  if (Date.now() - parsed.startedAt < score * game.minMsPerPoint) {
    return NextResponse.json(
      { error: "Score is not achievable in the elapsed time since the run started." },
      { status: 400 },
    );
  }

  const day = utcDayKey();
  const scoreKey = leaderboardScoreKey(game.slug, day);
  const metaKey = leaderboardMetaKey(game.slug, day);

  // Only keep each player's best score for the day. `gt` makes this a no-op
  // (returns 0 changed) if the stored score is already >= this submission.
  const changed = await redis.zadd(scoreKey, { gt: true }, { score, member: usernameLower });

  if (changed) {
    await redis.hset(metaKey, {
      [usernameLower]: JSON.stringify({
        name: user.username,
        score,
        timestamp: Date.now(),
      }),
    });
  }

  const rank = await redis.zrevrank(scoreKey, usernameLower);
  const bestScore = await redis.zscore(scoreKey, usernameLower);

  return NextResponse.json({
    ok: true,
    updated: Boolean(changed),
    bestScore: bestScore ?? score,
    rank: rank === null || rank === undefined ? null : rank + 1,
  });
}

function safeParse(value: string): RunTokenRecord | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
