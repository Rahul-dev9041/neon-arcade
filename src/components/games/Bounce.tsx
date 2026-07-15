"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const W = 400;
const H = 400;
const BALL_R = 10;
const GRAVITY = 0.35;
const BOUNCE_VY = -10.5;
const MOVE_VX = 4.2;
const CAMERA_LINE = 180; // rising above this scrolls the world down

type Platform = { x: number; y: number; w: number; vx: number };

export function Bounce({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballRef = useRef({ x: W / 2, y: 300, vx: 0, vy: 0 });
  const platformsRef = useRef<Platform[]>([]);
  const heightRef = useRef(0); // total world pixels climbed
  const nextSpawnYRef = useRef(0); // world-space y of the next platform to spawn
  const scoreRef = useRef(0);
  const inputRef = useRef(0); // -1 left, 0 none, 1 right
  const runningRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const rafRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);

  function platformWidth() {
    return Math.max(34, 64 - heightRef.current / 400);
  }

  function spawnPlatformAt(screenY: number) {
    const w = platformWidth();
    const movers = Math.min(0.5, heightRef.current / 8000); // more movers as you climb
    platformsRef.current.push({
      x: Math.random() * (W - w),
      y: screenY,
      w,
      vx: Math.random() < movers ? (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random()) : 0,
    });
  }

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    // altitude markers give the climb a sense of motion
    const offset = heightRef.current % 80;
    ctx.strokeStyle = "rgba(53, 229, 255, 0.05)";
    for (let y = offset; y < H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    for (const p of platformsRef.current) {
      ctx.save();
      ctx.shadowColor = p.vx ? "#ffd700" : "#39ff9c";
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.vx ? "#ffd700" : "#39ff9c";
      ctx.globalAlpha = 0.9;
      ctx.fillRect(p.x, p.y, p.w, 8);
      ctx.restore();
    }

    const ball = ballRef.current;
    ctx.save();
    ctx.shadowColor = "#60a5fa";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#60a5fa";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  const endGame = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  const step = useCallback(() => {
    if (!runningRef.current) return;
    const ball = ballRef.current;

    ball.vx = inputRef.current * MOVE_VX;
    ball.x += ball.vx;
    // wrap horizontally, classic climber style
    if (ball.x < -BALL_R) ball.x = W + BALL_R;
    if (ball.x > W + BALL_R) ball.x = -BALL_R;

    ball.vy += GRAVITY;
    ball.y += ball.vy;

    // platform bounce (only while falling)
    if (ball.vy > 0) {
      for (const p of platformsRef.current) {
        if (
          ball.x > p.x - BALL_R &&
          ball.x < p.x + p.w + BALL_R &&
          ball.y + BALL_R > p.y &&
          ball.y + BALL_R < p.y + 8 + ball.vy
        ) {
          ball.y = p.y - BALL_R;
          ball.vy = BOUNCE_VY;
          break;
        }
      }
    }

    // moving platforms
    for (const p of platformsRef.current) {
      if (!p.vx) continue;
      p.x += p.vx;
      if (p.x < 0 || p.x + p.w > W) p.vx *= -1;
    }

    // camera scroll: everything shifts down as the ball climbs
    if (ball.y < CAMERA_LINE) {
      const delta = CAMERA_LINE - ball.y;
      ball.y = CAMERA_LINE;
      heightRef.current += delta;
      platformsRef.current.forEach((p) => { p.y += delta; });
      nextSpawnYRef.current += delta;

      const newScore = Math.floor(heightRef.current / 10);
      if (newScore !== scoreRef.current) {
        scoreRef.current = newScore;
        setScore(newScore);
      }
    }

    // recycle platforms and keep the sky populated
    platformsRef.current = platformsRef.current.filter((p) => p.y < H + 12);
    while (nextSpawnYRef.current > -20) {
      spawnPlatformAt(nextSpawnYRef.current);
      nextSpawnYRef.current -= 48 + Math.random() * 34;
    }

    if (ball.y - BALL_R > H) {
      draw();
      endGame();
      return;
    }

    draw();
    rafRef.current = requestAnimationFrame(stepFrame);
  }, [draw, endGame]);

  const stepRef = useRef<() => void>(() => {});
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  function stepFrame() {
    stepRef.current();
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

    ballRef.current = { x: W / 2, y: 300, vx: 0, vy: BOUNCE_VY };
    heightRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    // opening platform field, including one right under the ball
    platformsRef.current = [{ x: W / 2 - 40, y: 330, w: 80, vx: 0 }];
    nextSpawnYRef.current = 280;
    while (nextSpawnYRef.current > -20) {
      spawnPlatformAt(nextSpawnYRef.current);
      nextSpawnYRef.current -= 48 + Math.random() * 34;
    }
    inputRef.current = 0;
    runningRef.current = true;
    setStatus("running");
    rafRef.current = requestAnimationFrame(stepFrame);
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); inputRef.current = -1; }
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); inputRef.current = 1; }
    }
    function up(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a") { if (inputRef.current === -1) inputRef.current = 0; }
      if (e.key === "ArrowRight" || e.key === "d") { if (inputRef.current === 1) inputRef.current = 0; }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const stagePointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    inputRef.current = e.clientX - rect.left < rect.width / 2 ? -1 : 1;
  }, []);

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">Height</span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: W, touchAction: "none" }}
        onPointerDown={stagePointer}
        onPointerMove={(e) => { if (e.buttons) stagePointer(e); }}
        onPointerUp={() => { inputRef.current = 0; }}
        onPointerLeave={() => { inputRef.current = 0; }}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-full" />
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="steer the bounce — gold platforms drift, edges wrap around"
        />
      </div>
    </div>
  );
}
