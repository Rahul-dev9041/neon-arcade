"use client";

import { useCallback, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const N = 9;
const BASE_MINES = 10;
const MAX_MINES = 20;

type CellState = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

function neighbors(r: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push([nr, nc]);
    }
  }
  return out;
}

function emptyBoard(): CellState[][] {
  return Array.from({ length: N }, () =>
    Array.from({ length: N }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  );
}

/** Mines placed after the first tap, excluding it and its neighbors — the
 *  opening click is always a safe flood, never a coin flip. */
function placeMines(board: CellState[][], mines: number, safeR: number, safeC: number) {
  const banned = new Set([`${safeR},${safeC}`, ...neighbors(safeR, safeC).map(([r, c]) => `${r},${c}`)]);
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * N);
    const c = Math.floor(Math.random() * N);
    if (board[r][c].mine || banned.has(`${r},${c}`)) continue;
    board[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      board[r][c].adjacent = neighbors(r, c).filter(([nr, nc]) => board[nr][nc].mine).length;
    }
  }
}

const NUM_COLORS = ["", "#35e5ff", "#39ff9c", "#ffd700", "#ff5ea8", "#f43f5e", "#a78bfa", "#fb923c", "#ffffff"];

export function Mines({ canPlay, onStart, onGameOver }: GameProps) {
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const scoreRef = useRef(0);
  const minesPlacedRef = useRef(false);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);
  const [board, setBoard] = useState<CellState[][]>(emptyBoard);
  const [level, setLevel] = useState(1);
  const [flagMode, setFlagMode] = useState(false);

  const endGame = useCallback(() => {
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  function mineCount(lvl: number) {
    return Math.min(MAX_MINES, BASE_MINES + (lvl - 1) * 2);
  }

  function reveal(r: number, c: number) {
    if (status !== "running") return;

    const next = board.map((row) => row.map((cell) => ({ ...cell })));

    if (!minesPlacedRef.current) {
      placeMines(next, mineCount(level), r, c);
      minesPlacedRef.current = true;
    }

    const cell = next[r][c];
    if (cell.revealed || cell.flagged) return;

    if (flagMode) {
      cell.flagged = true;
      setBoard(next);
      return;
    }

    if (cell.mine) {
      // show the whole minefield on death
      next.forEach((row) => row.forEach((cc) => { if (cc.mine) cc.revealed = true; }));
      setBoard(next);
      setTimeout(endGame, 700);
      return;
    }

    // flood fill from zero-adjacent cells
    const stack: [number, number][] = [[r, c]];
    let gained = 0;
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      const cur = next[cr][cc];
      if (cur.revealed || cur.mine) continue;
      cur.revealed = true;
      cur.flagged = false;
      gained++;
      if (cur.adjacent === 0) {
        for (const [nr, nc] of neighbors(cr, cc)) {
          if (!next[nr][nc].revealed) stack.push([nr, nc]);
        }
      }
    }
    scoreRef.current += gained;
    setScore(scoreRef.current);

    // board cleared → next level with more mines
    const allSafeRevealed = next.every((row) => row.every((cc) => cc.mine || cc.revealed));
    if (allSafeRevealed) {
      setBoard(next);
      setTimeout(() => {
        minesPlacedRef.current = false;
        setLevel((l) => l + 1);
        setBoard(emptyBoard());
      }, 800);
      return;
    }
    setBoard(next);
  }

  function toggleFlag(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (status !== "running" || !minesPlacedRef.current) return;
    const next = board.map((row) => row.map((cell) => ({ ...cell })));
    const cell = next[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    setBoard(next);
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
    setLevel(1);
    setFlagMode(false);
    minesPlacedRef.current = false;
    setBoard(emptyBoard());
    setStatus("running");
  }

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full gap-2">
        <span className="terminal-label">Cells · lvl {level}</span>
        <button
          type="button"
          className="btn-ghost text-xs !py-1"
          style={flagMode ? { color: "#fb923c", borderColor: "#fb923c" } : undefined}
          onClick={() => setFlagMode((f) => !f)}
        >
          ⚑ flag mode {flagMode ? "on" : "off"}
        </button>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: 400 }}
      >
        <div
          className="absolute inset-0 grid p-2 gap-1"
          style={{
            background: "#05060a",
            gridTemplateColumns: `repeat(${N}, 1fr)`,
            gridTemplateRows: `repeat(${N}, 1fr)`,
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => reveal(r, c)}
                onContextMenu={(e) => toggleFlag(e, r, c)}
                className="rounded-sm text-xs md:text-sm font-bold flex items-center justify-center"
                style={{
                  background: cell.revealed
                    ? cell.mine
                      ? "rgba(244, 63, 94, 0.4)"
                      : "rgba(57, 255, 156, 0.07)"
                    : "rgba(53, 229, 255, 0.14)",
                  border: "1px solid rgba(53, 229, 255, 0.12)",
                  color: cell.revealed ? NUM_COLORS[cell.adjacent] : "#fb923c",
                  cursor: cell.revealed ? "default" : "pointer",
                }}
              >
                {cell.revealed
                  ? cell.mine
                    ? "✸"
                    : cell.adjacent || ""
                  : cell.flagged
                    ? "⚑"
                    : ""}
              </button>
            )),
          )}
        </div>
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="first tap is always safe · clear the board to level up"
        />
      </div>
    </div>
  );
}
