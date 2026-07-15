import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { redis } from "@/lib/redis";
import { getSessionUser } from "@/lib/auth";
import { getGame } from "@/lib/games";
import { RUN_TOKEN_TTL_SECONDS, runTokenKey } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

/**
 * Issues a single-use run token when a game starts, bound to the logged-in
 * player AND the specific game. The server-recorded issue time is what the
 * submit endpoint later checks the score's elapsed time against.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to start a run." }, { status: 401 });
  }

  let body: { game?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const game = typeof body.game === "string" ? getGame(body.game) : undefined;
  if (!game) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }

  const token = randomUUID();
  await redis.set(
    runTokenKey(token),
    JSON.stringify({
      game: game.slug,
      startedAt: Date.now(),
      username: user.username.toLowerCase(),
    }),
    { ex: RUN_TOKEN_TTL_SECONDS },
  );
  return NextResponse.json({ runToken: token });
}
