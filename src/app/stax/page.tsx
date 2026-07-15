"use client";

import { GamePage } from "@/components/GamePage";
import { Stax } from "@/components/games/Stax";
import { getGame } from "@/lib/games";

export default function StaxPage() {
  return <GamePage game={getGame("stax")!} GameComponent={Stax} />;
}
