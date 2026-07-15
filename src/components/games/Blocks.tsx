"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const N = 4;
const PAD = 10;
const W = 400;
const CELL = (W - PAD * (N + 1)) / N;

type Grid = number[][]; // 0 = empty, otherwise tile value

const TILE_COLORS: Record<number, string> = {
  2: "#1c3a34", 4: "#1f4a3e", 8: "#39ff9c", 16: "#2fe0d0",
  32: "#35e5ff", 64: "#4aa8ff", 128: "#a78bfa", 256: "#ff5ea8",
  512: "#ff8c5e", 1024: "#ffd700", 2048: "#ffffff",
};

function emptyGrid(): Grid {
  return Array.from({ length: N }, () => Array(N).fill(0));
}

function addRandomTile(grid: Grid): boolean {
  const empty: [number, number][] = [];
  grid.forEach((row, y) => row.forEach((v, x) => { if (!v) empty.push([y, x]); }));
  if (!empty.length) return false;
  const [y, x] = empty[Math.floor(Math.random() * empty.length)];
  grid[y][x] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

/** Slides+merges one row leftward; returns [newRow, gainedScore, moved]. */
function slideRow(row: number[]): [number[], number, boolean] {
  const tiles = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < N) out.push(0);
  const moved = out.some((v, i) => v !== row[i]);
  return [out, gained, moved];
}

function hasMoves(grid: Grid): boolean {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!grid[y][x]) return true;
      if (x + 1 < N && grid[y][x] === grid[y][x + 1]) return true;
      if (y + 1 < N && grid[y][x] === grid[y + 1][x]) return true;
    }
  }
  return false;
}

export function Blocks({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<Grid>(emptyGrid());
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, W);

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const px = PAD + x * (CELL + PAD);
        const py = PAD + y * (CELL + PAD);
        const v = gridRef.current[y][x];

        ctx.fillStyle = "rgba(53, 229, 255, 0.05)";
        ctx.fillRect(px, py, CELL, CELL);

        if (!v) continue;
        const color = TILE_COLORS[v] ?? "#ffffff";
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = v >= 8 ? 12 : 0;
        ctx.fillStyle = color;
        ctx.globalAlpha = v < 8 ? 1 : 0.92;
        ctx.fillRect(px, py, CELL, CELL);
        ctx.restore();

        ctx.fillStyle = v < 8 ? "#a8ffcf" : "#05060a";
        ctx.font = `bold ${v >= 1024 ? 26 : 32}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(v), px + CELL / 2, py + CELL / 2 + 2);
      }
    }
  }, []);

  const endGame = useCallback(() => {
    runningRef.current = false;
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  const move = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (!runningRef.current) return;
      const grid = gridRef.current;
      let gainedTotal = 0;
      let movedAny = false;

      // Normalize every direction to a leftward slide via read/write mappers.
      for (let i = 0; i < N; i++) {
        const line: number[] = [];
        for (let j = 0; j < N; j++) {
          if (dir === "left") line.push(grid[i][j]);
          else if (dir === "right") line.push(grid[i][N - 1 - j]);
          else if (dir === "up") line.push(grid[j][i]);
          else line.push(grid[N - 1 - j][i]);
        }
        const [slid, gained, moved] = slideRow(line);
        gainedTotal += gained;
        movedAny = movedAny || moved;
        for (let j = 0; j < N; j++) {
          if (dir === "left") grid[i][j] = slid[j];
          else if (dir === "right") grid[i][N - 1 - j] = slid[j];
          else if (dir === "up") grid[j][i] = slid[j];
          else grid[N - 1 - j][i] = slid[j];
        }
      }

      if (!movedAny) return;
      scoreRef.current += gainedTotal;
      setScore(scoreRef.current);
      addRandomTile(grid);
      draw();
      if (!hasMoves(grid)) endGame();
    },
    [draw, endGame],
  );

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

    gridRef.current = emptyGrid();
    addRandomTile(gridRef.current);
    addRandomTile(gridRef.current);
    scoreRef.current = 0;
    setScore(0);
    runningRef.current = true;
    setStatus("running");
    draw();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">Score</span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: W, touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} width={W} height={W} className="block w-full h-full" />
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="merge equal tiles — how far past 2048 can you go?"
        />
      </div>
    </div>
  );
}
