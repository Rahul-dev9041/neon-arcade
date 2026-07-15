"use client";

import { GamePage } from "@/components/GamePage";
import { TicTacToe } from "@/components/games/TicTacToe";
import { getGame } from "@/lib/games";

export default function TicTacToePage() {
  return <GamePage game={getGame("tictactoe")!} GameComponent={TicTacToe} />;
}
