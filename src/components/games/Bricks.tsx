"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const W = 400;
const H = 400;
const PADDLE_W = 74;
const PADDLE_H = 10;
const PADDLE_Y = H - 26;
const BALL_R = 6;
const COLS = 8;
const ROWS = 5;
const BRICK_W = (W - 20) / COLS;
const BRICK_H = 18;
const BRICK_TOP = 46;

const ROW_COLORS = ["#ff5ea8", "#ffd700", "#39ff9c", "#35e5ff", "#a78bfa"];

type Brick = { x: number; y: number; alive: boolean; color: string };

function buildWall(): Brick[] {
  const bricks: Brick[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({
        x: 10 + c * BRICK_W,
        y: BRICK_TOP + r * (BRICK_H + 6),
        alive: true,
        color: ROW_COLORS[r % ROW_COLORS.length],
      });
    }
  }
  return bricks;
}

export function Bricks({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paddleXRef = useRef(W / 2 - PADDLE_W / 2);
  const ballRef = useRef({ x: W / 2, y: PADDLE_Y - 20, vx: 2.4, vy: -3.4 });
  const bricksRef = useRef<Brick[]>([]);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const rafRef = useRef(0);
  const keysRef = useRef({ left: false, right: false });

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    // bricks
    for (const b of bricksRef.current) {
      if (!b.alive) continue;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(b.x + 2, b.y, BRICK_W - 4, BRICK_H);
      ctx.restore();
    }

    // paddle
    ctx.save();
    ctx.shadowColor = "#35e5ff";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#35e5ff";
    ctx.fillRect(paddleXRef.current, PADDLE_Y, PADDLE_W, PADDLE_H);
    ctx.restore();

    // ball
    const ball = ballRef.current;
    ctx.save();
    ctx.shadowColor = "#39ff9c";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#39ff9c";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // level tag
    ctx.fillStyle = "rgba(124, 148, 144, 0.8)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`level ${levelRef.current}`, W - 12, 18);
  }, []);

  const endGame = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  const step = useCallback(() => {
    if (!runningRef.current) return;

    // keyboard paddle movement
    if (keysRef.current.left) paddleXRef.current -= 6;
    if (keysRef.current.right) paddleXRef.current += 6;
    paddleXRef.current = Math.max(0, Math.min(W - PADDLE_W, paddleXRef.current));

    const ball = ballRef.current;
    const speedScale = Math.min(1.5, 1 + (levelRef.current - 1) * 0.12);
    ball.x += ball.vx * speedScale;
    ball.y += ball.vy * speedScale;

    // walls
    if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx *= -1; }
    if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx *= -1; }
    if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy *= -1; }

    // paddle
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= PADDLE_Y &&
      ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 6 &&
      ball.x >= paddleXRef.current - BALL_R &&
      ball.x <= paddleXRef.current + PADDLE_W + BALL_R
    ) {
      ball.y = PADDLE_Y - BALL_R;
      ball.vy = -Math.abs(ball.vy);
      // hit position steers the ball — the skill mechanic
      const hit = (ball.x - (paddleXRef.current + PADDLE_W / 2)) / (PADDLE_W / 2);
      ball.vx = hit * 3.6;
      if (Math.abs(ball.vx) < 0.6) ball.vx = ball.vx < 0 ? -0.6 : 0.6;
    }

    // bricks
    const hitIdx = bricksRef.current.findIndex(
      (b) =>
        b.alive &&
        ball.x + BALL_R > b.x &&
        ball.x - BALL_R < b.x + BRICK_W &&
        ball.y + BALL_R > b.y &&
        ball.y - BALL_R < b.y + BRICK_H,
    );
    if (hitIdx >= 0) {
      const b = bricksRef.current[hitIdx];
      bricksRef.current = bricksRef.current.map((bb, i) =>
        i === hitIdx ? { ...bb, alive: false } : bb,
      );
      scoreRef.current++;
      setScore(scoreRef.current);
      // reflect on the shallower penetration axis
      const fromLeft = Math.abs(ball.x - b.x);
      const fromRight = Math.abs(ball.x - (b.x + BRICK_W));
      const fromTop = Math.abs(ball.y - b.y);
      const fromBottom = Math.abs(ball.y - (b.y + BRICK_H));
      const minX = Math.min(fromLeft, fromRight);
      const minY = Math.min(fromTop, fromBottom);
      if (minX < minY) ball.vx *= -1;
      else ball.vy *= -1;
    }

    // wall cleared → next level
    if (bricksRef.current.every((b) => !b.alive)) {
      levelRef.current++;
      bricksRef.current = buildWall();
      ball.x = W / 2;
      ball.y = PADDLE_Y - 20;
      ball.vy = -Math.abs(ball.vy);
    }

    // ball lost — single life, arcade rules
    if (ball.y - BALL_R > H) {
      draw();
      endGame();
      return;
    }

    draw();
    rafRef.current = requestAnimationFrame(stepFrame);
  }, [draw, endGame]);

  // Hoisted trampoline so the rAF loop always calls the latest `step`
  // without a use-before-declaration inside the callback itself.
  const stepRef = useRef<() => void>(() => {});
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  function stepFrame() {
    stepRef.current();
  }

  const movePaddleTo = useCallback((clientX: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    paddleXRef.current = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
  }, []);

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

    paddleXRef.current = W / 2 - PADDLE_W / 2;
    ballRef.current = { x: W / 2, y: PADDLE_Y - 20, vx: 2.4 * (Math.random() < 0.5 ? 1 : -1), vy: -3.4 };
    bricksRef.current = buildWall();
    levelRef.current = 1;
    scoreRef.current = 0;
    setScore(0);
    runningRef.current = true;
    setStatus("running");
    rafRef.current = requestAnimationFrame(stepFrame);
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); keysRef.current.left = true; }
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); keysRef.current.right = true; }
    }
    function up(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">Bricks</span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        ref={stageRef}
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: W, touchAction: "none" }}
        onPointerMove={(e) => movePaddleTo(e.clientX)}
        onPointerDown={(e) => movePaddleTo(e.clientX)}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-full" />
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="one ball, one life — angle your shots off the paddle edges"
        />
      </div>
    </div>
  );
}
