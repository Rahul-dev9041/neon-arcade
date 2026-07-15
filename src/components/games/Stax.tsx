"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const COLS = 10;
const ROWS = 20;
const CELL = 20;
const BOARD_X = 100; // board centered in the 400px stage
const W = 400;
const H = 400;

type Shape = { size: number; cells: [number, number][]; color: string };

const SHAPES: Shape[] = [
  { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: "#35e5ff" }, // I
  { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: "#ffd700" }, // O
  { size: 3, cells: [[0, 1], [1, 1], [2, 1], [1, 0]], color: "#e879f9" }, // T
  { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: "#39ff9c" }, // S
  { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#f43f5e" }, // Z
  { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#4aa8ff" }, // J
  { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#fb923c" }, // L
];

const LINE_POINTS = [0, 100, 300, 500, 800];

type Piece = { shape: Shape; cells: [number, number][]; x: number; y: number };

function rotateCells(cells: [number, number][], size: number): [number, number][] {
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

export function Stax({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<(string | null)[][]>([]);
  const pieceRef = useRef<Piece | null>(null);
  const nextShapeRef = useRef<Shape>(SHAPES[0]);
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const runningRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    // board frame
    ctx.strokeStyle = "rgba(53, 229, 255, 0.35)";
    ctx.strokeRect(BOARD_X - 1, 0, COLS * CELL + 2, ROWS * CELL);

    const drawCell = (gx: number, gy: number, color: string) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.fillRect(BOARD_X + gx * CELL + 1, gy * CELL + 1, CELL - 2, CELL - 2);
      ctx.restore();
    };

    gridRef.current.forEach((row, y) =>
      row.forEach((c, x) => {
        if (c) drawCell(x, y, c);
      }),
    );

    const piece = pieceRef.current;
    if (piece) {
      for (const [cx, cy] of piece.cells) {
        const gy = piece.y + cy;
        if (gy >= 0) drawCell(piece.x + cx, gy, piece.shape.color);
      }
    }

    // next piece preview
    ctx.fillStyle = "rgba(124, 148, 144, 0.9)";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("next", BOARD_X + COLS * CELL + 16, 20);
    const next = nextShapeRef.current;
    for (const [cx, cy] of next.cells) {
      ctx.save();
      ctx.shadowColor = next.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = next.color;
      ctx.fillRect(BOARD_X + COLS * CELL + 16 + cx * 14, 32 + cy * 14, 12, 12);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(124, 148, 144, 0.9)";
    ctx.fillText(`lines ${linesRef.current}`, BOARD_X + COLS * CELL + 16, H - 16);
  }, []);

  const collides = useCallback((cells: [number, number][], px: number, py: number) => {
    for (const [cx, cy] of cells) {
      const gx = px + cx;
      const gy = py + cy;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
      if (gy >= 0 && gridRef.current[gy][gx]) return true;
    }
    return false;
  }, []);

  const endGame = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  const spawn = useCallback((): boolean => {
    const shape = nextShapeRef.current;
    nextShapeRef.current = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const piece: Piece = { shape, cells: [...shape.cells], x: 3, y: -1 };
    if (collides(piece.cells, piece.x, piece.y + 1)) return false;
    pieceRef.current = piece;
    return true;
  }, [collides]);

  const lockPiece = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece) return;
    for (const [cx, cy] of piece.cells) {
      const gy = piece.y + cy;
      if (gy >= 0) gridRef.current[gy][piece.x + cx] = piece.shape.color;
    }
    // clear full lines
    const remaining = gridRef.current.filter((row) => row.some((c) => !c));
    const cleared = ROWS - remaining.length;
    if (cleared > 0) {
      while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
      gridRef.current = remaining;
      linesRef.current += cleared;
      scoreRef.current += LINE_POINTS[cleared];
      setScore(scoreRef.current);
    }
    if (!spawn()) {
      draw();
      endGame();
    }
  }, [spawn, draw, endGame]);

  const gravity = useCallback(() => {
    if (!runningRef.current) return;
    const piece = pieceRef.current;
    if (piece) {
      if (!collides(piece.cells, piece.x, piece.y + 1)) {
        piece.y++;
      } else {
        lockPiece();
      }
    }
    draw();
    if (!runningRef.current) return;
    const speed = Math.max(120, 700 - Math.floor(linesRef.current / 10) * 60);
    timerRef.current = setTimeout(gravityFrame, speed);
  }, [collides, lockPiece, draw]);

  // Trampoline so the timeout chain always runs the latest gravity closure.
  const gravityRef = useRef<() => void>(() => {});
  useEffect(() => {
    gravityRef.current = gravity;
  }, [gravity]);
  function gravityFrame() {
    gravityRef.current();
  }

  const act = useCallback(
    (action: "left" | "right" | "down" | "rotate" | "drop") => {
      if (!runningRef.current) return;
      const piece = pieceRef.current;
      if (!piece) return;

      if (action === "left" && !collides(piece.cells, piece.x - 1, piece.y)) piece.x--;
      if (action === "right" && !collides(piece.cells, piece.x + 1, piece.y)) piece.x++;
      if (action === "down" && !collides(piece.cells, piece.x, piece.y + 1)) piece.y++;
      if (action === "rotate" && piece.shape.size > 2) {
        const rotated = rotateCells(piece.cells, piece.shape.size);
        for (const kick of [0, -1, 1, -2, 2]) {
          if (!collides(rotated, piece.x + kick, piece.y)) {
            piece.cells = rotated;
            piece.x += kick;
            break;
          }
        }
      }
      if (action === "drop") {
        while (!collides(piece.cells, piece.x, piece.y + 1)) piece.y++;
        lockPiece();
      }
      draw();
    },
    [collides, lockPiece, draw],
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

    gridRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    nextShapeRef.current = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    scoreRef.current = 0;
    linesRef.current = 0;
    setScore(0);
    spawn();
    runningRef.current = true;
    setStatus("running");
    draw();
    timerRef.current = setTimeout(gravityFrame, 700);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, Parameters<typeof act>[0]> = {
        ArrowLeft: "left", a: "left",
        ArrowRight: "right", d: "right",
        ArrowDown: "down", s: "down",
        ArrowUp: "rotate", w: "rotate",
        " ": "drop",
      };
      const action = map[e.key];
      if (!action) return;
      e.preventDefault();
      act(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const padBtn = (label: string, action: Parameters<typeof act>[0]) => (
    <button
      type="button"
      className="btn-ghost !p-0 w-12 h-12 flex items-center justify-center text-base"
      style={{ touchAction: "manipulation" }}
      onClick={() => act(action)}
    >
      {label}
    </button>
  );

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">Score</span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: W, touchAction: "none" }}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-full" />
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="clear lines — four at once for the big points"
        />
      </div>

      <div className="flex gap-1.5 select-none">
        {padBtn("◀", "left")}
        {padBtn("▼", "down")}
        {padBtn("⟳", "rotate")}
        {padBtn("▶", "right")}
        {padBtn("⤓", "drop")}
      </div>
    </div>
  );
}
