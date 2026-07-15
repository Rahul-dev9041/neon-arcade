"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const W = 400;
const H = 400;
const BAR_Y = H / 2;
const BAR_H = 26;
const MARKER_W = 10;

export function Reflex({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerXRef = useRef(0);
  const markerDirRef = useRef(1);
  const speedRef = useRef(3);
  const zoneRef = useRef({ x: 160, w: 90 });
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const lockRef = useRef(false); // brief input lock between rounds
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const rafRef = useRef(0);
  const flashRef = useRef<{ color: string; until: number } | null>(null);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    // round + streak
    ctx.fillStyle = "rgba(124, 148, 144, 0.9)";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`round ${scoreRef.current + 1}`, W / 2, BAR_Y - 60);

    // track
    ctx.fillStyle = "rgba(53, 229, 255, 0.08)";
    ctx.fillRect(20, BAR_Y - BAR_H / 2, W - 40, BAR_H);

    // target zone
    const z = zoneRef.current;
    ctx.save();
    ctx.shadowColor = "#ff5ea8";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(255, 94, 168, 0.55)";
    ctx.fillRect(z.x, BAR_Y - BAR_H / 2, z.w, BAR_H);
    ctx.restore();

    // marker
    ctx.save();
    ctx.shadowColor = "#35e5ff";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#35e5ff";
    ctx.fillRect(markerXRef.current, BAR_Y - BAR_H / 2 - 8, MARKER_W, BAR_H + 16);
    ctx.restore();

    // hit/miss flash
    const flash = flashRef.current;
    if (flash && Date.now() < flash.until) {
      ctx.fillStyle = flash.color;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "rgba(124, 148, 144, 0.7)";
    ctx.font = "11px monospace";
    ctx.fillText("stop the marker inside the pink zone", W / 2, BAR_Y + 70);
  }, []);

  const endGame = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    markerXRef.current += speedRef.current * markerDirRef.current;
    if (markerXRef.current <= 20 || markerXRef.current + MARKER_W >= W - 20) {
      markerDirRef.current *= -1;
      markerXRef.current = Math.max(20, Math.min(W - 20 - MARKER_W, markerXRef.current));
    }
    draw();
    rafRef.current = requestAnimationFrame(loopFrame);
  }, [draw]);

  // Hoisted trampoline so the rAF loop always calls the latest `loop`
  // without a use-before-declaration inside the callback itself.
  const loopRef = useRef<() => void>(() => {});
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);
  function loopFrame() {
    loopRef.current();
  }

  function newRound() {
    const s = scoreRef.current;
    // zone shrinks and marker speeds up each round
    const w = Math.max(26, 90 - s * 3.2);
    zoneRef.current = { x: 30 + Math.random() * (W - 60 - w), w };
    speedRef.current = Math.min(9.5, 3 + s * 0.32);
    markerXRef.current = 20;
    markerDirRef.current = 1;
  }

  const stopMarker = useCallback(() => {
    if (!runningRef.current || lockRef.current) return;
    const z = zoneRef.current;
    const mx = markerXRef.current + MARKER_W / 2;
    if (mx >= z.x && mx <= z.x + z.w) {
      scoreRef.current++;
      setScore(scoreRef.current);
      flashRef.current = { color: "#39ff9c", until: Date.now() + 160 };
      lockRef.current = true;
      setTimeout(() => {
        lockRef.current = false;
        newRound();
      }, 220);
    } else {
      flashRef.current = { color: "#ff5ea8", until: Date.now() + 240 };
      draw();
      endGame();
    }
  }, [draw, endGame]);

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
    newRound();
    runningRef.current = true;
    setStatus("running");
    rafRef.current = requestAnimationFrame(loopFrame);
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        stopMarker();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopMarker]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">Rounds</span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: W, touchAction: "none" }}
        onPointerDown={stopMarker}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-full" />
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="tap / space when the marker crosses the pink zone"
        />
      </div>
    </div>
  );
}
