"use client";

import { GamePage } from "@/components/GamePage";
import { Pop } from "@/components/games/Pop";
import { getGame } from "@/lib/games";

export default function PopPage() {
  return <GamePage game={getGame("pop")!} GameComponent={Pop} />;
}
