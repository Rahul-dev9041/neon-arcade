"use client";

import { useEffect, useRef, useState } from "react";

/** Self-hosted GIFs (public/celebrations) so the party never 404s. */
const CELEBRATION_GIFS = [
  "/celebrations/fireworks.gif",
  "/celebrations/confetti.gif",
  "/celebrations/trophy.gif",
];

const RANK_LABEL: Record<number, { title: string; color: string }> = {
  1: { title: "#1 · TOP OF THE GRID!", color: "#ffd700" },
  2: { title: "#2 · SILVER SERPENT!", color: "#c9c9d6" },
  3: { title: "#3 · ON THE PODIUM!", color: "#cd7f32" },
};

const CONFETTI_COLORS = ["#39ff9c", "#35e5ff", "#ffd700", "#ff5ea8", "#a8ffcf"];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
};

/**
 * Full-screen top-3 celebration: a live canvas confetti burst layered under a
 * random celebration GIF. Auto-plays the moment the rank comes back from the
 * leaderboard API; dismissed by click or the close button.
 */
export function Celebration({
  rank,
  score,
  onClose,
}: {
  rank: number;
  score: number;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Pick the GIF once per celebration, not per render.
  const [gif] = useState(
    () => CELEBRATION_GIFS[Math.floor(Math.random() * CELEBRATION_GIFS.length)],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    function burst(cx: number, cy: number, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 9;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          size: 4 + Math.random() * 6,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.3,
        });
      }
    }

    burst(canvas.width / 2, canvas.height / 2, 90);
    const extraBursts = [
      setTimeout(() => burst(canvas.width * 0.25, canvas.height * 0.35, 60), 500),
      setTimeout(() => burst(canvas.width * 0.75, canvas.height * 0.35, 60), 1000),
    ];

    let raf = 0;
    function frame() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += 0.18; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        if (p.y > canvas.height + 20) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      extraBursts.forEach(clearTimeout);
    };
  }, []);

  const label = RANK_LABEL[rank] ?? RANK_LABEL[3];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-4 text-center"
      style={{ background: "rgba(5, 6, 10, 0.9)" }}
      onClick={onClose}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <p
        className="text-xl md:text-3xl font-bold tracking-widest relative"
        style={{ color: label.color, textShadow: `0 0 14px ${label.color}` }}
      >
        {label.title}
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element -- local animated GIF; next/image would freeze/re-encode it */}
      <img
        src={gif}
        alt="celebration"
        className="relative rounded-md neon-border-cyan w-full max-w-sm"
      />

      <p className="relative text-sm" style={{ color: "var(--ink)" }}>
        <span className="neon-text-green font-bold">{score}</span> points put you in
        today&apos;s top 3
      </p>

      <button
        type="button"
        className="btn-neon relative"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Keep Playing
      </button>
    </div>
  );
}
