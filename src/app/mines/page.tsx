"use client";

import { GamePage } from "@/components/GamePage";
import { Mines } from "@/components/games/Mines";
import { getGame } from "@/lib/games";

export default function MinesPage() {
  return <GamePage game={getGame("mines")!} GameComponent={Mines} />;
}
