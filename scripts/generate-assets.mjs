import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Regenerates the promo/branding images in public/ for the FREE edition
 * (the originals were inherited from the paid USDC version and still
 * advertised session pricing). Run with: node scripts/generate-assets.mjs
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");

const VOID = "#05060a";
const GREEN = "#39ff9c";
const CYAN = "#35e5ff";

function snakeIconSvg(size) {
  const cell = size / 8;
  // A simple pixel-snake glyph: neon green body turning toward a cyan food dot.
  const body = [
    [1, 3],
    [2, 3],
    [3, 3],
    [3, 2],
    [3, 1],
    [4, 1],
  ];
  const rects = body
    .map(
      ([x, y], i) =>
        `<rect x="${x * cell}" y="${y * cell}" width="${cell * 0.92}" height="${cell * 0.92}" rx="${cell * 0.18}" fill="${i === body.length - 1 ? "#a8ffcf" : GREEN}"/>`,
    )
    .join("");

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0d1a17"/>
      <stop offset="100%" stop-color="${VOID}"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="${size * 0.02}"/></filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  <g filter="url(#blur)" opacity="0.9">${rects}</g>
  <g>${rects}</g>
  <circle cx="${6 * cell + cell / 2}" cy="${1.5 * cell}" r="${cell * 0.4}" fill="${CYAN}"/>
</svg>`;
}

function heroSvg(width, height) {
  const cell = height / 10;
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070a10"/>
      <stop offset="100%" stop-color="${VOID}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  ${Array.from({ length: Math.floor(width / cell) })
    .map((_, i) => `<line x1="${i * cell}" y1="0" x2="${i * cell}" y2="${height}" stroke="${CYAN}" stroke-opacity="0.05"/>`)
    .join("")}
  ${Array.from({ length: Math.floor(height / cell) })
    .map((_, i) => `<line x1="0" y1="${i * cell}" x2="${width}" y2="${i * cell}" stroke="${CYAN}" stroke-opacity="0.05"/>`)
    .join("")}
  <text x="${width * 0.08}" y="${height * 0.42}" font-family="monospace" font-size="${height * 0.11}" font-weight="700" fill="${GREEN}">NEON ARCADE</text>
  <text x="${width * 0.08}" y="${height * 0.58}" font-family="monospace" font-size="${height * 0.055}" fill="${CYAN}">// 5 GAMES · 1 ACCOUNT · DAILY LEADERBOARDS</text>
  <text x="${width * 0.08}" y="${height * 0.78}" font-family="monospace" font-size="${height * 0.045}" fill="#7c9490">SNAKE · GLIDE · BLOCKS · REFLEX · BRICKS</text>
</svg>`;
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });

  await sharp(Buffer.from(snakeIconSvg(1024)))
    .png()
    .flatten({ background: VOID })
    .toFile(path.join(PUBLIC_DIR, "icon.png"));

  await sharp(Buffer.from(heroSvg(1200, 630)))
    .png()
    .toFile(path.join(PUBLIC_DIR, "hero.png"));

  await sharp(Buffer.from(heroSvg(1200, 630)))
    .png()
    .toFile(path.join(PUBLIC_DIR, "embed.png"));

  await sharp(Buffer.from(snakeIconSvg(64)))
    .png()
    .toFile(path.join(PUBLIC_DIR, "favicon.png"));

  console.log("Generated icon.png, hero.png, embed.png, favicon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
