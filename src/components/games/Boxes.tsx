"use client";

import { useCallback, useRef, useState } from "react";
import { Overlay } from "@/components/games/Overlay";
import type { GameProps } from "@/components/games/types";

const N = 4; // boxes per side (5x5 dots)
const DOT = (i: number) => 40 + i * 80;

type Edges = { h: boolean[][]; v: boolean[][] }; // h[r][c]: r 0..N, c 0..N-1 · v[r][c]: r 0..N-1, c 0..N
type Owner = ("me" | "ai" | null)[][];

function emptyEdges(): Edges {
  return {
    h: Array.from({ length: N + 1 }, () => Array(N).fill(false)),
    v: Array.from({ length: N }, () => Array(N + 1).fill(false)),
  };
}
function emptyOwners(): Owner {
  return Array.from({ length: N }, () => Array(N).fill(null));
}

function boxSides(edges: Edges, r: number, c: number): number {
  return (
    (edges.h[r][c] ? 1 : 0) +
    (edges.h[r + 1][c] ? 1 : 0) +
    (edges.v[r][c] ? 1 : 0) +
    (edges.v[r][c + 1] ? 1 : 0)
  );
}

type Move = { kind: "h" | "v"; r: number; c: number };

function allMoves(edges: Edges): Move[] {
  const moves: Move[] = [];
  edges.h.forEach((row, r) => row.forEach((set, c) => { if (!set) moves.push({ kind: "h", r, c }); }));
  edges.v.forEach((row, r) => row.forEach((set, c) => { if (!set) moves.push({ kind: "v", r, c }); }));
  return moves;
}

function applyMove(edges: Edges, m: Move): Edges {
  const next = { h: edges.h.map((r) => [...r]), v: edges.v.map((r) => [...r]) };
  next[m.kind][m.r][m.c] = true;
  return next;
}

/** Boxes an edge would complete. */
function completions(edges: Edges, m: Move): [number, number][] {
  const done: [number, number][] = [];
  const test = applyMove(edges, m);
  if (m.kind === "h") {
    if (m.r > 0 && boxSides(test, m.r - 1, m.c) === 4 && boxSides(edges, m.r - 1, m.c) === 3) done.push([m.r - 1, m.c]);
    if (m.r < N && boxSides(test, m.r, m.c) === 4 && boxSides(edges, m.r, m.c) === 3) done.push([m.r, m.c]);
  } else {
    if (m.c > 0 && boxSides(test, m.r, m.c - 1) === 4 && boxSides(edges, m.r, m.c - 1) === 3) done.push([m.r, m.c - 1]);
    if (m.c < N && boxSides(test, m.r, m.c) === 4 && boxSides(edges, m.r, m.c) === 3) done.push([m.r, m.c]);
  }
  return done;
}

/** Greedy AI: take completions, else avoid handing over a 3-sided box. */
function aiPick(edges: Edges): Move {
  const moves = allMoves(edges);
  const winning = moves.filter((m) => completions(edges, m).length > 0);
  if (winning.length) return winning[0];

  const safe = moves.filter((m) => {
    const after = applyMove(edges, m);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (boxSides(after, r, c) === 3) return false;
      }
    }
    return true;
  });
  const pool = safe.length ? safe : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function Boxes({ canPlay, onStart, onGameOver }: GameProps) {
  const runTokenRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const scoreRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "over">("idle");
  const [score, setScore] = useState(0);
  const [edges, setEdges] = useState<Edges>(emptyEdges);
  const [owners, setOwners] = useState<Owner>(emptyOwners);
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState("your line — green");

  const endGame = useCallback(() => {
    setStatus("over");
    onGameOver(scoreRef.current, runTokenRef.current);
  }, [onGameOver]);

  function counts(o: Owner) {
    let me = 0, ai = 0;
    o.forEach((row) => row.forEach((v) => { if (v === "me") me++; if (v === "ai") ai++; }));
    return { me, ai };
  }

  function finishMatch(o: Owner) {
    const { me, ai } = counts(o);
    if (me > ai) {
      scoreRef.current += me;
      setScore(scoreRef.current);
      setNote(`won ${me}–${ai} · +${me} · next match`);
      setLocked(true);
      setTimeout(() => {
        setEdges(emptyEdges());
        setOwners(emptyOwners());
        setNote("your line — green");
        setLocked(false);
      }, 1200);
    } else {
      setNote(me === ai ? `tied ${me}–${ai} — run over` : `lost ${me}–${ai} — run over`);
      setTimeout(endGame, 900);
    }
  }

  function aiTurn(startEdges: Edges, startOwners: Owner) {
    let curEdges = startEdges;
    let curOwners = startOwners;

    const playOne = () => {
      if (allMoves(curEdges).length === 0) {
        finishMatch(curOwners);
        return;
      }
      const m = aiPick(curEdges);
      const done = completions(curEdges, m);
      curEdges = applyMove(curEdges, m);
      curOwners = curOwners.map((row) => [...row]);
      done.forEach(([r, c]) => { curOwners[r][c] = "ai"; });
      setEdges(curEdges);
      setOwners(curOwners);

      if (allMoves(curEdges).length === 0) {
        finishMatch(curOwners);
        return;
      }
      if (done.length > 0) {
        setTimeout(playOne, 420); // box completed → AI moves again
      } else {
        setNote("your line — green");
        setLocked(false);
      }
    };
    setTimeout(playOne, 420);
  }

  function handleEdge(kind: "h" | "v", r: number, c: number) {
    if (status !== "running" || locked) return;
    if (edges[kind][r][c]) return;

    const m: Move = { kind, r, c };
    const done = completions(edges, m);
    const nextEdges = applyMove(edges, m);
    const nextOwners = owners.map((row) => [...row]);
    done.forEach(([br, bc]) => { nextOwners[br][bc] = "me"; });
    setEdges(nextEdges);
    setOwners(nextOwners);

    if (allMoves(nextEdges).length === 0) {
      finishMatch(nextOwners);
      return;
    }
    if (done.length > 0) return; // completed a box → go again

    setNote("machine is drawing…");
    setLocked(true);
    aiTurn(nextEdges, nextOwners);
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
    setEdges(emptyEdges());
    setOwners(emptyOwners());
    setNote("your line — green");
    setLocked(false);
    setStatus("running");
  }

  const { me, ai } = counts(owners);

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col items-center gap-4 relative">
      <div className="flex items-center justify-between w-full">
        <span className="terminal-label">
          Boxes <span className="neon-text-green">{me}</span>–<span style={{ color: "#ff5ea8" }}>{ai}</span>
        </span>
        <span className="text-lg md:text-xl font-bold neon-text-cyan">{score}</span>
      </div>

      <div
        className="relative neon-border-green rounded-md overflow-hidden w-full max-w-full aspect-square"
        style={{ maxWidth: 400 }}
      >
        <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" style={{ background: "#05060a" }}>
          {/* captured boxes */}
          {owners.map((row, r) =>
            row.map((owner, c) =>
              owner ? (
                <rect
                  key={`b-${r}-${c}`}
                  x={DOT(c) + 6}
                  y={DOT(r) + 6}
                  width={68}
                  height={68}
                  fill={owner === "me" ? "rgba(57,255,156,0.18)" : "rgba(255,94,168,0.18)"}
                />
              ) : null,
            ),
          )}
          {/* horizontal edges */}
          {Array.from({ length: N + 1 }, (_, r) =>
            Array.from({ length: N }, (_, c) => (
              <g key={`h-${r}-${c}`} onClick={() => handleEdge("h", r, c)} style={{ cursor: "pointer" }}>
                <rect x={DOT(c) + 6} y={DOT(r) - 9} width={68} height={18} fill="transparent" />
                <line
                  x1={DOT(c) + 5}
                  y1={DOT(r)}
                  x2={DOT(c + 1) - 5}
                  y2={DOT(r)}
                  stroke={edges.h[r][c] ? "#35e5ff" : "rgba(53,229,255,0.12)"}
                  strokeWidth={4}
                  strokeLinecap="round"
                  style={edges.h[r][c] ? { filter: "drop-shadow(0 0 4px #35e5ff)" } : undefined}
                />
              </g>
            )),
          )}
          {/* vertical edges */}
          {Array.from({ length: N }, (_, r) =>
            Array.from({ length: N + 1 }, (_, c) => (
              <g key={`v-${r}-${c}`} onClick={() => handleEdge("v", r, c)} style={{ cursor: "pointer" }}>
                <rect x={DOT(c) - 9} y={DOT(r) + 6} width={18} height={68} fill="transparent" />
                <line
                  x1={DOT(c)}
                  y1={DOT(r) + 5}
                  x2={DOT(c)}
                  y2={DOT(r + 1) - 5}
                  stroke={edges.v[r][c] ? "#35e5ff" : "rgba(53,229,255,0.12)"}
                  strokeWidth={4}
                  strokeLinecap="round"
                  style={edges.v[r][c] ? { filter: "drop-shadow(0 0 4px #35e5ff)" } : undefined}
                />
              </g>
            )),
          )}
          {/* dots on top */}
          {Array.from({ length: N + 1 }, (_, r) =>
            Array.from({ length: N + 1 }, (_, c) => (
              <circle key={`d-${r}-${c}`} cx={DOT(c)} cy={DOT(r)} r={5} fill="#d8e6e1" />
            )),
          )}
        </svg>
        <div className="scanlines" />
        <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none">
          <span className="terminal-label">{note}</span>
        </div>
        <Overlay
          status={status}
          score={score}
          canPlay={canPlay}
          onStart={startGame}
          readyHint="close a box to move again · win the match to bank its boxes"
        />
      </div>
    </div>
  );
}
