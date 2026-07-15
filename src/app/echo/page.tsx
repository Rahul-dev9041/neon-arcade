"use client";

import { GamePage } from "@/components/GamePage";
import { Echo } from "@/components/games/Echo";
import { getGame } from "@/lib/games";

export default function EchoPage() {
  return <GamePage game={getGame("echo")!} GameComponent={Echo} />;
}
