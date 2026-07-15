import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Generates the self-hosted top-3 celebration GIFs in public/celebrations/.
 * Self-hosted (instead of hotlinking a GIF service) so the celebration can
 * never break on an external outage and stays in the game's neon palette.
 *
 * Run with: node scripts/generate-celebrations.mjs
 */

const OUT_DIR = path.join(process.cwd(), "public", "celebrations");

const W = 480;
const H = 360;
const FRAMES = 18;
const DELAY_MS = 70;

const VOID = "#05060a";
const NEON = ["#39ff9c", "#35e5ff", "#ffd700", "#ff5ea8", "#a8ffcf"];

// Deterministic PRNG so re-running the script produces identical assets.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function frameSvg(inner) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${VOID}"/>
  ${inner}
</svg>`;
}

function fireworksFrames() {
  const rand = mulberry32(42);
  const bursts = Array.from({ length: 5 }, (_, i) => ({
    x: 60 + rand() * (W - 120),
    y: 50 + rand() * (H - 140),
    start: i * 3,
    color: NEON[i % NEON.length],
    particles: Array.from({ length: 14 }, () => ({
      angle: rand() * Math.PI * 2,
      speed: 40 + rand() * 55,
    })),
  }));

  return Array.from({ length: FRAMES }, (_, f) => {
    const parts = bursts
      .map((b) => {
        const t = (f - b.start + FRAMES) % FRAMES;
        if (t > 9) return "";
        const progress = t / 9;
        const opacity = (1 - progress).toFixed(2);
        return b.particles
          .map((p) => {
            const d = p.speed * progress;
            const px = b.x + Math.cos(p.angle) * d;
            const py = b.y + Math.sin(p.angle) * d + 14 * progress * progress;
            const r = 3.4 * (1 - progress * 0.6);
            return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${b.color}" opacity="${opacity}"/>`;
          })
          .join("");
      })
      .join("");
    return frameSvg(parts);
  });
}

function confettiFrames() {
  const rand = mulberry32(7);
  const pieces = Array.from({ length: 46 }, () => ({
    x: rand() * W,
    y: rand() * H,
    w: 5 + rand() * 7,
    h: 8 + rand() * 9,
    color: NEON[Math.floor(rand() * NEON.length)],
    fall: 14 + rand() * 22,
    sway: 6 + rand() * 12,
    spin: rand() * 360,
  }));

  return Array.from({ length: FRAMES }, (_, f) => {
    const t = f / FRAMES;
    const parts = pieces
      .map((p) => {
        const y = (p.y + p.fall * f) % (H + 24) - 12;
        const x = p.x + Math.sin(t * Math.PI * 2 + p.x) * p.sway;
        const rot = p.spin + f * 24;
        return `<rect x="${(-p.w / 2).toFixed(1)}" y="${(-p.h / 2).toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" fill="${p.color}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})"/>`;
      })
      .join("");
    return frameSvg(parts);
  });
}

function trophyFrames() {
  const rand = mulberry32(99);
  const sparks = Array.from({ length: 16 }, (_, i) => ({
    x: 60 + rand() * (W - 120),
    y: 30 + rand() * (H - 60),
    phase: i % FRAMES,
  }));

  // Simple neon trophy glyph built from primitives, centered.
  const cx = W / 2;
  const trophy = (glow, scale) => `
    <g transform="translate(${cx} 190) scale(${scale}) translate(${-cx} -190)" stroke="#ffd700" stroke-width="7" fill="none" opacity="${glow}" stroke-linecap="round">
      <path d="M ${cx - 52} 90 h 104 v 44 a 52 52 0 0 1 -104 0 z" fill="rgba(255,215,0,0.14)"/>
      <path d="M ${cx - 52} 100 c -34 0 -34 44 0 44" />
      <path d="M ${cx + 52} 100 c 34 0 34 44 0 44" />
      <line x1="${cx}" y1="188" x2="${cx}" y2="222"/>
      <path d="M ${cx - 34} 236 h 68" stroke-width="10"/>
    </g>`;

  return Array.from({ length: FRAMES }, (_, f) => {
    const pulse = 0.72 + 0.28 * Math.sin((f / FRAMES) * Math.PI * 2);
    const scale = 0.97 + 0.05 * Math.sin((f / FRAMES) * Math.PI * 2);
    const sparkles = sparks
      .map((s) => {
        const t = (f - s.phase + FRAMES) % FRAMES;
        if (t > 5) return "";
        const o = (1 - t / 5).toFixed(2);
        const r = 2 + t;
        return `<g stroke="#35e5ff" stroke-width="2" opacity="${o}">
          <line x1="${s.x - r}" y1="${s.y}" x2="${s.x + r}" y2="${s.y}"/>
          <line x1="${s.x}" y1="${s.y - r}" x2="${s.x}" y2="${s.y + r}"/>
        </g>`;
      })
      .join("");
    return frameSvg(`${sparkles}${trophy(pulse.toFixed(2), scale.toFixed(3))}`);
  });
}

async function writeGif(name, svgFrames) {
  const buffers = await Promise.all(
    svgFrames.map((svg) => sharp(Buffer.from(svg)).png().toBuffer()),
  );
  await sharp(buffers, { join: { animated: true } })
    .gif({ delay: DELAY_MS, loop: 0 })
    .toFile(path.join(OUT_DIR, name));
  console.log(`wrote ${name} (${svgFrames.length} frames)`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await writeGif("fireworks.gif", fireworksFrames());
  await writeGif("confetti.gif", confettiFrames());
  await writeGif("trophy.gif", trophyFrames());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
