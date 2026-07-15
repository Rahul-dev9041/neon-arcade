"use client";

import { GamePage } from "@/components/GamePage";
import { Reflex } from "@/components/games/Reflex";
import { getGame } from "@/lib/games";

export default function ReflexPage() {
  return <GamePage game={getGame("reflex")!} GameComponent={Reflex} />;
}
