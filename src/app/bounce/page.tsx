"use client";

import { GamePage } from "@/components/GamePage";
import { Bounce } from "@/components/games/Bounce";
import { getGame } from "@/lib/games";

export default function BouncePage() {
  return <GamePage game={getGame("bounce")!} GameComponent={Bounce} />;
}
