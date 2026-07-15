"use client";

import { GamePage } from "@/components/GamePage";
import { Boxes } from "@/components/games/Boxes";
import { getGame } from "@/lib/games";

export default function BoxesPage() {
  return <GamePage game={getGame("boxes")!} GameComponent={Boxes} />;
}
