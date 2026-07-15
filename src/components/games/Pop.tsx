"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const W = 400;
const H = 400;
const R = 19; // bubble radius
const COL_W = 40;
const ROW_H = 34;
const TOP = 20;
const SHOOTER = { x: W / 2, y: 364 };
const LOSE_ROW = 9; // bubbles at/below this row end the run
const SHOTS_PER_ROW = 6;
const BALL_SPEED = 8;

const COLORS = ["#39ff9c", "#35e5ff", "#ffd700", "#ff5ea8", "#a78bfa"];

type Cell = number | null; // color index
type Ball = { x: number; y: number; vx: number; vy: number; color: number };

export function Pop({ canPlay, onStart, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<Cell[][]>([]);
  const parityRef = useRef(0); // flips when a fresh row is pushed on top
  const ballRef = useRef<Ball | null>(null);
  const currentRef = useRef(0);
  const nextRef = useRef(1);
  const aimRef = useRef(-Math.PI / 2);
  const shotsRef = useRef(0);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const rafRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);

  const rowLen = useCallback((r: number) => ((r + parityRef.current) % 2 === 0 ? 10 : 9), []);
  const cellPos = useCallback(
    (r: number, c: number) => ({
      x: 20 + c * COL_W + ((r + parityRef.current) % 2 === 0 ? 0 : COL_W / 2),
      y: TOP + r * ROW_H,
    }),
    [],
  );

  const neighbors = useCallback(
    (r: number, c: number): [number, number][] => {
      const odd = (r + parityRef.current) % 2 === 1;
      const raw: [number, number][] = odd
        ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
        : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
      return raw.filter(
        ([nr, nc]) => nr >= 0 && nr < rowsRef.current.length && nc >= 0 && nc < rowLen(nr),
      );
    },
    [rowLen],
  );

  const colorsOnBoard = useCallback((): number[] => {
    const present = new Set<number>();
    rowsRef.current.forEach((row) => row.forEach((c) => { if (c !== null) present.add(c); }));
    return present.size ? [...present] : [0];
  }, []);

  const pickColor = useCallback(() => {
    const opts = colorsOnBoard();
    return opts[Math.floor(Math.random() * opts.length)];
  }, [colorsOnBoard]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    // lose line
    const loseY = TOP + LOSE_ROW * ROW_H + R;
    ctx.strokeStyle = "rgba(244, 63, 94, 0.35)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, loseY);
    ctx.lineTo(W, loseY);
    ctx.stroke();
    ctx.setLineDash([]);

    const bubble = (x: number, y: number, color: string, radius = R) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, radius - 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    rowsRef.current.forEach((row, r) =>
      row.forEach((c, ci) => {
        if (c === null) return;
        const p = cellPos(r, ci);
        bubble(p.x, p.y, COLORS[c]);
      }),
    );

    // aim guide
    const aim = aimRef.current;
    ctx.strokeStyle = "rgba(216, 230, 225, 0.25)";
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(SHOOTER.x, SHOOTER.y);
    ctx.lineTo(SHOOTER.x + Math.cos(aim) * 70, SHOOTER.y + Math.sin(aim) * 70);
    ctx.stroke();
    ctx.setLineDash([]);

    // flying ball
    const ball = ballRef.current;
    if (ball) bubble(ball.x, ball.y, COLORS[ball.color]);

    // shooter: current + next
    bubble(SHOOTER.x, SHOOTER.y, COLORS[currentRef.current]);
    bubble(SHOOTER.x + 44, SHOOTER.y + 8, COLORS[nextRef.current], 10);
    ctx.fillStyle = "rgba(124, 148, 144, 0.8)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("next", SHOOTER.x + 60, SHOOTER.y + 12);
  }, [cellPos]);

  const endGame = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  /** Pops the landed cluster if ≥3, then drops anything left floating. */
  const resolveBoard = useCallback(
    (landR: number, landC: number) => {
      const rows = rowsRef.current;
      const color = rows[landR][landC];
      if (color === null) return;

      // same-color cluster from the landing cell
      const cluster = new Set<string>();
      const stack: [number, number][] = [[landR, landC]];
      while (stack.length) {
        const [r, c] = stack.pop()!;
        const key = `${r},${c}`;
        if (cluster.has(key) || rows[r][c] !== color) continue;
        cluster.add(key);
        for (const [nr, nc] of neighbors(r, c)) {
          if (rows[nr][nc] === color) stack.push([nr, nc]);
        }
      }

      if (cluster.size >= 3) {
        cluster.forEach((key) => {
          const [r, c] = key.split(",").map(Number);
          rows[r][c] = null;
        });
        scoreRef.current += cluster.size;

        // anything not connected to the ceiling falls
        const anchored = new Set<string>();
        const seeds: [number, number][] = [];
        rows[0]?.forEach((c, ci) => { if (c !== null) seeds.push([0, ci]); });
        while (seeds.length) {
          const [r, c] = seeds.pop()!;
          const key = `${r},${c}`;
          if (anchored.has(key) || rows[r][c] === null) continue;
          anchored.add(key);
          for (const [nr, nc] of neighbors(r, c)) {
            if (rows[nr][nc] !== null) seeds.push([nr, nc]);
          }
        }
        let dropped = 0;
        rows.forEach((row, r) =>
          row.forEach((c, ci) => {
            if (c !== null && !anchored.has(`${r},${ci}`)) {
              rows[r][ci] = null;
              dropped++;
            }
          }),
        );
        scoreRef.current += dropped * 2;
        setScore(scoreRef.current);
      }

      // trim empty trailing rows
      while (rowsRef.current.length && rowsRef.current[rowsRef.current.length - 1].every((c) => c === null)) {
        rowsRef.current.pop();
      }
    },
    [neighbors],
  );

  const checkLose = useCallback((): boolean => {
    for (let r = LOSE_ROW; r < rowsRef.current.length; r++) {
      if (rowsRef.current[r].some((c) => c !== null)) return true;
    }
    return false;
  }, []);

  const landBall = useCallback(
    (ball: Ball) => {
      const rows = rowsRef.current;
      // nearest cell to the ball's resting point
      let r = Math.max(0, Math.round((ball.y - TOP) / ROW_H));
      while (rows.length <= r) {
        rows.push(Array(rowLen(rows.length)).fill(null));
      }
      let c = Math.round(
        (ball.x - 20 - ((r + parityRef.current) % 2 === 0 ? 0 : COL_W / 2)) / COL_W,
      );
      c = Math.max(0, Math.min(rowLen(r) - 1, c));

      // if occupied, take the nearest empty neighbor
      if (rows[r][c] !== null) {
        let best: [number, number] | null = null;
        let bestD = Infinity;
        for (const [nr, nc] of neighbors(r, c)) {
          if (rows[nr][nc] !== null) continue;
          const p = cellPos(nr, nc);
          const d = (p.x - ball.x) ** 2 + (p.y - ball.y) ** 2;
          if (d < bestD) { bestD = d; best = [nr, nc]; }
        }
        if (!best) {
          // fully boxed in — extend downward
          const nr = r + 1;
          while (rows.length <= nr) rows.push(Array(rowLen(rows.length)).fill(null));
          best = [nr, Math.max(0, Math.min(rowLen(nr) - 1, c))];
        }
        [r, c] = best;
      }

      rows[r][c] = ball.color;
      resolveBoard(r, c);

      // reload the shooter
      currentRef.current = nextRef.current;
      nextRef.current = pickColor();
      shotsRef.current++;

      // pressure: a fresh row descends every few shots
      if (shotsRef.current % SHOTS_PER_ROW === 0) {
        parityRef.current ^= 1;
        rowsRef.current.unshift(
          Array(rowLen(0)).fill(null).map(() => Math.floor(Math.random() * COLORS.length)),
        );
      }

      if (checkLose()) {
        draw();
        endGame();
        return;
      }
      draw();
    },
    [rowLen, neighbors, cellPos, resolveBoard, pickColor, checkLose, draw, endGame],
  );

  const step = useCallback(() => {
    if (!runningRef.current) return;
    const ball = ballRef.current;
    if (ball) {
      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.x - R < 0) { ball.x = R; ball.vx *= -1; }
      if (ball.x + R > W) { ball.x = W - R; ball.vx *= -1; }

      let landed = ball.y - R <= TOP - R / 2;
      if (!landed) {
        outer: for (let r = 0; r < rowsRef.current.length; r++) {
          for (let c = 0; c < rowsRef.current[r].length; c++) {
            if (rowsRef.current[r][c] === null) continue;
            const p = cellPos(r, c);
            if ((p.x - ball.x) ** 2 + (p.y - ball.y) ** 2 < (2 * R - 4) ** 2) {
              landed = true;
              break outer;
            }
          }
        }
      }
      if (landed) {
        ballRef.current = null;
        landBall(ball);
        if (!runningRef.current) return;
      }
    }
    draw();
    rafRef.current = requestAnimationFrame(stepFrame);
  }, [cellPos, landBall, draw]);

  const stepRef = useRef<() => void>(() => {});
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  function stepFrame() {
    stepRef.current();
  }

  const pointerAngle = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return aimRef.current;
    const rect = stage.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    const angle = Math.atan2(y - SHOOTER.y, x - SHOOTER.x);
    // keep shots pointed upward
    return Math.max(-Math.PI + 0.25, Math.min(-0.25, angle));
  }, []);

  const shoot = useCallback(() => {
    if (!runningRef.current || ballRef.current) return;
    const aim = aimRef.current;
    ballRef.current = {
      x: SHOOTER.x,
      y: SHOOTER.y,
      vx: Math.cos(aim) * BALL_SPEED,
      vy: Math.sin(aim) * BALL_SPEED,
      color: currentRef.current,
    };
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

    parityRef.current = 0;
    rowsRef.current = Array.from({ length: 5 }, (_, r) =>
      Array(rowLen(r)).fill(null).map(() => Math.floor(Math.random() * COLORS.length)),
    );
    ballRef.current = null;
    currentRef.current = Math.floor(Math.random() * COLORS.length);
    nextRef.current = Math.floor(Math.random() * COLORS.length);
    shotsRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    runningRef.current = true;
    setStatus("running");
    rafRef.current = requestAnimationFrame(stepFrame);
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

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
        ref={stageRef}
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: W, touchAction: "none" }}
        onPointerMove={(e) => {
          aimRef.current = pointerAngle(e.clientX, e.clientY);
        }}
        onPointerDown={(e) => {
          aimRef.current = pointerAngle(e.clientX, e.clientY);
          shoot();
        }}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-full" />
        <div className="scanlines" />
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="match 3+ to pop · dropped clusters score double"
        />
      </div>
    </div>
  );
}
