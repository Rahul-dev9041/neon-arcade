"use client";

import { useCallback, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

type Cell = "X" | "O" | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** The AI plays optimally 70% of the time — perfect play would make every
 *  game a draw and the win-streak leaderboard unwinnable. */
const AI_MISTAKE_RATE = 0.3;

function winner(board: Cell[]): Cell {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function minimax(board: Cell[], player: "X" | "O"): { score: number; move: number } {
  const w = winner(board);
  if (w === "O") return { score: 1, move: -1 };
  if (w === "X") return { score: -1, move: -1 };
  if (board.every(Boolean)) return { score: 0, move: -1 };

  let best = { score: player === "O" ? -Infinity : Infinity, move: -1 };
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = player;
    const { score } = minimax(board, player === "O" ? "X" : "O");
    board[i] = null;
    if (player === "O" ? score > best.score : score < best.score) {
      best = { score, move: i };
    }
  }
  return best;
}

function aiMove(board: Cell[]): number {
  const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (Math.random() < AI_MISTAKE_RATE) {
    return empty[Math.floor(Math.random() * empty.length)];
  }
  return minimax([...board], "O").move;
}

export function TicTacToe({ canPlay, onStart, onGameOver }: GameProps) {
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const scoreRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState("your move — you're X");

  const endGame = useCallback(() => {
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  function nextBoard(message: string) {
    setNote(message);
    setLocked(true);
    setTimeout(() => {
      setBoard(Array(9).fill(null));
      setNote("your move — you're X");
      setLocked(false);
    }, 900);
  }

  function handleCell(i: number) {
    if (status !== "running" || locked || board[i]) return;

    const afterPlayer = [...board];
    afterPlayer[i] = "X";
    setBoard(afterPlayer);

    if (winner(afterPlayer) === "X") {
      scoreRef.current++;
      setScore(scoreRef.current);
      nextBoard("you win! streak +1");
      return;
    }
    if (afterPlayer.every(Boolean)) {
      nextBoard("draw — streak survives");
      return;
    }

    // AI replies after a beat so the exchange reads as turns, not teleports.
    setLocked(true);
    setTimeout(() => {
      const move = aiMove(afterPlayer);
      const afterAi = [...afterPlayer];
      afterAi[move] = "O";
      setBoard(afterAi);

      if (winner(afterAi) === "O") {
        setNote("the machine wins — run over");
        setTimeout(endGame, 700);
        return;
      }
      if (afterAi.every(Boolean)) {
        nextBoard("draw — streak survives");
        return;
      }
      setLocked(false);
    }, 350);
  }

  async function startGame() {
    if (!canPlay || startingRef.current) return;
    startingRef.current = true;
    setStatus("starting");
    const token = await onStart();
    startingRef.current = false;
    if (!token) {
      setStatus("idle");
      return;
    }
    runTokenRef.current = token;
    scoreRef.current = 0;
    setScore(0);
    setBoard(Array(9).fill(null));
    setNote("your move — you're X");
    setLocked(false);
    setStatus("running");
  }

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">Win Streak</span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: 400 }}
      >
        <div className="absolute inset-0 flex flex-col p-4 gap-2" style={{ background: "#05060a" }}>
          <div className="grid grid-cols-3 gap-2 flex-1">
            {board.map((cell, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleCell(i)}
                className="rounded-md text-4xl md:text-5xl font-bold flex items-center justify-center"
                style={{
                  background: "rgba(53, 229, 255, 0.05)",
                  border: "1px solid var(--glass-border)",
                  color: cell === "X" ? "#39ff9c" : "#ff5ea8",
                  textShadow: cell ? `0 0 14px ${cell === "X" ? "#39ff9c" : "#ff5ea8"}` : "none",
                  cursor: cell || locked ? "default" : "pointer",
                }}
              >
                {cell}
              </button>
            ))}
          </div>
          <p className="terminal-label text-center">{note}</p>
        </div>
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="win to extend the streak · draws are safe · one loss ends it"
        />
      </div>
    </div>
  );
}
