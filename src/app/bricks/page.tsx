"use client";

import { GamePage } from "@/components/GamePage";
import { Bricks } from "@/components/games/Bricks";
import { getGame } from "@/lib/games";

export default function BricksPage() {
  return <GamePage game={getGame("bricks")!} GameComponent={Bricks} />;
}
