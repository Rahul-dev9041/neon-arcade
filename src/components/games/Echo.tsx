"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const PADS = [
  { color: "#39ff9c", tone: 329.63 },
  { color: "#35e5ff", tone: 261.63 },
  { color: "#ffd700", tone: 220.0 },
  { color: "#ff5ea8", tone: 164.81 },
];

export function Echo({ canPlay, onStart, onGameOver }: GameProps) {
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const scoreRef = useRef(0);
  const sequenceRef = useRef<number[]>([]);
  const inputPosRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [phase, setPhase] = useState<"watch" | "repeat">("watch");

  const beep = useCallback((pad: number, duration = 0.28) => {
    try {
      audioRef.current ??= new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = PADS[pad].tone;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // no audio permission / support — the game is fully playable silently
    }
  }, []);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const endGame = useCallback(() => {
    clearTimers();
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver, clearTimers]);

  const playSequence = useCallback(() => {
    setPhase("watch");
    inputPosRef.current = 0;
    // playback speeds up as the sequence grows
    const stepMs = Math.max(260, 620 - scoreRef.current * 18);
    sequenceRef.current.forEach((pad, i) => {
      timeoutsRef.current.push(
        setTimeout(() => {
          setLit(pad);
          beep(pad);
          timeoutsRef.current.push(setTimeout(() => setLit(null), stepMs * 0.6));
        }, 500 + i * stepMs),
      );
    });
    timeoutsRef.current.push(
      setTimeout(() => setPhase("repeat"), 500 + sequenceRef.current.length * stepMs),
    );
  }, [beep]);

  const nextRound = useCallback(() => {
    sequenceRef.current.push(Math.floor(Math.random() * 4));
    playSequence();
  }, [playSequence]);

  function handlePad(pad: number) {
    if (status !== "running" || phase !== "repeat") return;
    setLit(pad);
    beep(pad, 0.18);
    timeoutsRef.current.push(setTimeout(() => setLit(null), 160));

    if (pad !== sequenceRef.current[inputPosRef.current]) {
      setTimeout(endGame, 400);
      return;
    }
    inputPosRef.current++;
    if (inputPosRef.current === sequenceRef.current.length) {
      scoreRef.current++;
      setScore(scoreRef.current);
      timeoutsRef.current.push(setTimeout(nextRound, 600));
      setPhase("watch");
    }
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
    sequenceRef.current = [];
    setStatus("running");
    nextRound();
  }

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">Rounds</span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: 400 }}
      >
        <div className="absolute inset-0 flex flex-col p-5 gap-3" style={{ background: "#05060a" }}>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {PADS.map((pad, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePad(i)}
                className="rounded-lg transition-all"
                style={{
                  background: lit === i ? pad.color : `${pad.color}22`,
                  border: `1px solid ${pad.color}66`,
                  boxShadow: lit === i ? `0 0 26px ${pad.color}` : "none",
                  cursor: phase === "repeat" ? "pointer" : "default",
                  touchAction: "manipulation",
                }}
              />
            ))}
          </div>
          <p className="terminal-label text-center">
            {status === "running" ? (phase === "watch" ? "watch the pattern…" : "your turn — repeat it") : " "}
          </p>
        </div>
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="the pattern grows by one each round — sound on helps"
        />
      </div>
    </div>
  );
}
