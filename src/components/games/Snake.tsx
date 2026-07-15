"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GRID_SIZE, tickMsForScore } from "@/lib/gameConstants";
import type { GameProps } from "@/components/games/types";

const CELL_PX = 20;
const CANVAS_PX = GRID_SIZE * CELL_PX;

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function randomCell(exclude: Point[]): Point {
  let cell: Point;
  do {
    cell = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (exclude.some((p) => p.x === cell.x && p.y === cell.y));
  return cell;
}

export function Snake({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<Point[]>([]);
  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");
  const foodRef = useRef<Point>({ x: 10, y: 10 });
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [status, setStatus] = useState<"idle" | "running" | "over" | "starting">("idle");
  const [score, setScore] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

    ctx.strokeStyle = "rgba(53, 229, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_PX, 0);
      ctx.lineTo(i * CELL_PX, CANVAS_PX);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_PX);
      ctx.lineTo(CANVAS_PX, i * CELL_PX);
      ctx.stroke();
    }

    // food
    const food = foodRef.current;
    ctx.save();
    ctx.shadowColor = "#35e5ff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#35e5ff";
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_PX + CELL_PX / 2,
      food.y * CELL_PX + CELL_PX / 2,
      CELL_PX / 2.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    // snake
    const snake = snakeRef.current;
    ctx.save();
    ctx.shadowColor = "#39ff9c";
    ctx.shadowBlur = 10;
    snake.forEach((segment, i) => {
      ctx.fillStyle = i === 0 ? "#a8ffcf" : "#39ff9c";
      ctx.fillRect(
        segment.x * CELL_PX + 1,
        segment.y * CELL_PX + 1,
        CELL_PX - 2,
        CELL_PX - 2,
      );
    });
    ctx.restore();
  }, []);

  const endGame = useCallback(() => {
    runningRef.current = false;
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    directionRef.current = queuedDirectionRef.current;
    const head = snakeRef.current[0];
    const dir = directionRef.current;
    const next: Point = {
      x: head.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0),
      y: head.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0),
    };

    const hitWall =
      next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE;
    const hitSelf = snakeRef.current.some(
      (segment) => segment.x === next.x && segment.y === next.y,
    );

    if (hitWall || hitSelf) {
      draw();
      endGame();
      return;
    }

    const ateFood = next.x === foodRef.current.x && next.y === foodRef.current.y;
    const newSnake = [next, ...snakeRef.current];
    if (!ateFood) {
      newSnake.pop();
    } else {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      foodRef.current = randomCell(newSnake);
    }
    snakeRef.current = newSnake;
    draw();
  }, [draw, endGame]);

  // Self-rescheduling timeout instead of a fixed interval so each tick's
  // delay tracks the current score — the progressive speed curve.
  useEffect(() => {
    if (status !== "running") return;
    let timeout: ReturnType<typeof setTimeout>;
    function loop() {
      timeout = setTimeout(() => {
        tick();
        loop();
      }, tickMsForScore(scoreRef.current));
    }
    loop();
    return () => clearTimeout(timeout);
  }, [status, tick]);

  // Shared by keyboard, swipe, and the on-screen D-pad so all three input
  // methods behave identically (same reversal guard, same target ref).
  const queueDirection = useCallback((next: Direction) => {
    if (next === OPPOSITE[directionRef.current]) return;
    queuedDirectionRef.current = next;
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const map: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const next = map[e.key];
      if (!next) return;
      e.preventDefault();
      queueDirection(next);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [queueDirection]);

  const SWIPE_THRESHOLD_PX = 24;

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;

    const direction: Direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    queueDirection(direction);
  }

  async function startGame() {
    if (!canPlay || startingRef.current) return;
    startingRef.current = true;
    setStatus("starting");

    // Grab a fresh run token before the snake starts moving. If the request
    // fails the run simply doesn't start — a tokenless run could never be
    // submitted to the leaderboard, so starting it would only mislead.
    const runToken = await onStart();
    startingRef.current = false;

    if (!runToken) {
      setStatus("idle");
      return;
    }
    runTokenRef.current = runToken;

    const initialSnake: Point[] = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    snakeRef.current = initialSnake;
    directionRef.current = "right";
    queuedDirectionRef.current = "right";
    foodRef.current = randomCell(initialSnake);
    scoreRef.current = 0;
    setScore(0);
    runningRef.current = true;
    setStatus("running");
    draw();
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
        style={{ maxWidth: CANVAS_PX, touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_PX}
          height={CANVAS_PX}
          className="block w-full h-full"
        />
        <div className="scanlines" />

        {status !== "running" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4"
            style={{ background: "rgba(5, 6, 10, 0.82)" }}
          >
            {status === "starting" ? (
              <p className="neon-text-cyan text-sm terminal-label">
                entering the grid…
              </p>
            ) : status === "over" ? (
              <>
                <p className="neon-text-green text-base md:text-lg font-bold">GAME OVER</p>
                <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
                  final score: {score}
                </p>
                {canPlay ? (
                  <button className="btn-neon mt-2" onClick={startGame}>
                    Play Again
                  </button>
                ) : (
                  <p className="terminal-label mt-2">
                    sign in to keep playing
                  </p>
                )}
              </>
            ) : !canPlay ? (
              <>
                <p className="neon-text-cyan text-sm terminal-label">
                  sign in to play
                </p>
                <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
                  create a free account to enter the grid
                </p>
              </>
            ) : (
              <button className="btn-neon" onClick={startGame}>
                Start Run
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 select-none">
        <span />
        <DPadButton direction="up" onPress={queueDirection}>
          ▲
        </DPadButton>
        <span />
        <DPadButton direction="left" onPress={queueDirection}>
          ◀
        </DPadButton>
        <span />
        <DPadButton direction="right" onPress={queueDirection}>
          ▶
        </DPadButton>
        <span />
        <DPadButton direction="down" onPress={queueDirection}>
          ▼
        </DPadButton>
        <span />
      </div>
    </div>
  );
}

function DPadButton({
  direction,
  onPress,
  children,
}: {
  direction: Direction;
  onPress: (direction: Direction) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="btn-ghost !p-0 w-12 h-12 flex items-center justify-center text-base"
      style={{ touchAction: "manipulation" }}
      onClick={() => onPress(direction)}
    >
      {children}
    </button>
  );
}
