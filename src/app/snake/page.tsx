"use client";

import { GamePage } from "@/components/GamePage";
import { Snake } from "@/components/games/Snake";
import { getGame } from "@/lib/games";

export default function SnakePage() {
  return <GamePage game={getGame("snake")!} GameComponent={Snake} />;
}
