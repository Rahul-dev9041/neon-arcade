"use client";

import { GamePage } from "@/components/GamePage";
import { Glide } from "@/components/games/Glide";
import { getGame } from "@/lib/games";

export default function GlidePage() {
  return <GamePage game={getGame("glide")!} GameComponent={Glide} />;
}
