"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const W = 400;
const H = 400;
const BIRD_X = 90;
const BIRD_R = 9;
const GRAVITY = 0.42;
const FLAP_VY = -6.6;
const PIPE_W = 52;

type Pipe = { x: number; gapY: number; gapH: number; scored: boolean };

export function Glide({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdYRef = useRef(H / 2);
  const vyRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const framesRef = useRef(0);
  const runningRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const rafRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    // faint grid
    ctx.strokeStyle = "rgba(53, 229, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // pipes
    ctx.save();
    ctx.shadowColor = "#39ff9c";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(57, 255, 156, 0.85)";
    for (const p of pipesRef.current) {
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
      ctx.fillRect(p.x, p.gapY + p.gapH, PIPE_W, H - p.gapY - p.gapH);
    }
    ctx.restore();

    // bird
    ctx.save();
    ctx.shadowColor = "#35e5ff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#35e5ff";
    ctx.beginPath();
    ctx.arc(BIRD_X, birdYRef.current, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
    // eye hint in flight direction
    ctx.fillStyle = "#05060a";
    ctx.beginPath();
    ctx.arc(BIRD_X + 3.5, birdYRef.current - 2.5, 2, 0, Math.PI * 2);
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
    framesRef.current++;

    // difficulty ramps with score: pipes speed up, gaps tighten
    const s = scoreRef.current;
    const speed = Math.min(3.4, 2.2 + s * 0.04);
    const spawnEvery = Math.max(52, 88 - s); // frames between pipes

    vyRef.current += GRAVITY;
    birdYRef.current += vyRef.current;

    if (framesRef.current % spawnEvery === 0) {
      const gapH = Math.max(104, 136 - s * 1.2);
      const gapY = 30 + Math.random() * (H - gapH - 60);
      pipesRef.current.push({ x: W, gapY, gapH, scored: false });
    }

    pipesRef.current = pipesRef.current
      .map((p) => {
        const x = p.x - speed;
        if (!p.scored && x + PIPE_W < BIRD_X - BIRD_R) {
          scoreRef.current++;
          setScore(scoreRef.current);
          return { ...p, x, scored: true };
        }
        return { ...p, x };
      })
      .filter((p) => p.x + PIPE_W > -4);

    // collisions: floor/ceiling + pipes
    const y = birdYRef.current;
    if (y - BIRD_R < 0 || y + BIRD_R > H) {
      draw();
      endGame();
      return;
    }
    for (const p of pipesRef.current) {
      const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
      if (inX && (y - BIRD_R < p.gapY || y + BIRD_R > p.gapY + p.gapH)) {
        draw();
        endGame();
        return;
      }
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

  const flap = useCallback(() => {
    if (!runningRef.current) return;
    vyRef.current = FLAP_VY;
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

    birdYRef.current = H / 2;
    vyRef.current = FLAP_VY; // opening hop so the run doesn't start in freefall
    pipesRef.current = [];
    framesRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    runningRef.current = true;
    setStatus("running");
    rafRef.current = requestAnimationFrame(stepFrame);
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        flap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

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
        onPointerDown={flap}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-full" />
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="tap / space to flap — thread the gaps"
        />
      </div>
    </div>
  );
}
