"use client";

import { GamePage } from "@/components/GamePage";
import { Blocks } from "@/components/games/Blocks";
import { getGame } from "@/lib/games";

export default function BlocksPage() {
  return <GamePage game={getGame("blocks")!} GameComponent={Blocks} />;
}
