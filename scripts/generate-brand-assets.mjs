/**
 * Generates all GitFit brand PNGs (app icons, splash mark, favicon) from the
 * commit-graph-dumbbell geometry. Mirror of src/constants/brand.ts — keep the
 * numbers in sync when the mark changes.
 *
 * Usage: npm run generate:brand   (writes into assets/images/)
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

// --- palette (mirror of src/constants/theme.ts) ---
const BACKGROUND = '#08080A';
const PRIMARY = '#D4F53C';
const PRIMARY_LIGHT = '#E6FF85';
const WHITE = '#FFFFFF';
// The accent node strokes against the lime mark, mirroring GitFitLogo's rule
// that the accent flips to near-white whenever the mark itself is lime.
const ACCENT = WHITE;
const GLOW = 'rgba(212,245,60,0.22)';
const GLOW_EDGE = 'rgba(212,245,60,0)';

// --- geometry (mirror of src/constants/brand.ts) ---
const VIEW = 128;
// Bar is a rounded rect, not a stroked line: gradient paints on a zero-height
// line bounding box don't render in librsvg.
const BAR = { x: 14, y: 60, width: 100, height: 8, rx: 4 };
const NODES = [
  { cx: 22, cy: 64, r: 12, filled: true, accent: false },
  { cx: 46, cy: 64, r: 8, filled: false, accent: false },
  { cx: 82, cy: 64, r: 8, filled: false, accent: true },
  { cx: 106, cy: 64, r: 12, filled: true, accent: false },
];
const RING_STROKE = 5;

/** The bare mark, sized to the 128 viewbox. */
function markSvg({ gradient = true, mono = null } = {}) {
  const paint = mono ?? (gradient ? 'url(#logo-fill)' : PRIMARY);
  const accentPaint = mono ?? ACCENT;
  const defs = gradient && !mono
    ? `<defs><linearGradient id="logo-fill" x1="0" y1="0" x2="1" y2="0">
         <stop offset="0" stop-color="${PRIMARY}"/>
         <stop offset="1" stop-color="${PRIMARY_LIGHT}"/>
       </linearGradient></defs>`
    : '';
  const nodes = NODES.map((n) =>
    n.filled
      ? `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${paint}"/>`
      : `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="none" stroke="${n.accent ? accentPaint : paint}" stroke-width="${RING_STROKE}"/>`,
  ).join('\n');
  return `${defs}
    <rect x="${BAR.x}" y="${BAR.y}" width="${BAR.width}" height="${BAR.height}" rx="${BAR.rx}" fill="${paint}"/>
    ${nodes}`;
}

/**
 * Compose a square SVG: optional background fill + glow, mark centered at
 * `scale` (fraction of the canvas the 128-unit viewbox occupies).
 */
function composeSvg({ size, background = null, glow = false, scale = 0.62, gradient = true, mono = null }) {
  const markSize = size * scale;
  const offset = (size - markSize) / 2;
  const factor = markSize / VIEW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
    ${glow ? `<defs><radialGradient id="bg-glow" cx="0.5" cy="0.42" r="0.55">
        <stop offset="0" stop-color="${GLOW}"/>
        <stop offset="1" stop-color="${GLOW_EDGE}"/>
      </radialGradient></defs>
      <rect width="${size}" height="${size}" fill="url(#bg-glow)"/>` : ''}
    <g transform="translate(${offset} ${offset}) scale(${factor})">
      ${markSvg({ gradient, mono })}
    </g>
  </svg>`;
}

async function writePng(name, svg) {
  const file = path.join(OUT_DIR, name);
  await sharp(Buffer.from(svg)).png().toFile(file);
  const meta = await sharp(file).metadata();
  console.log(`wrote ${name} (${meta.width}x${meta.height})`);
}

await mkdir(OUT_DIR, { recursive: true });

// Main app icon + iOS light: mark on near-black with a soft glow.
const mainIcon = composeSvg({ size: 1024, background: BACKGROUND, glow: true, scale: 0.66 });
await writePng('icon.png', mainIcon);
await writePng('ios-icon-light.png', mainIcon);
// iOS dark: transparent background, colored mark (system supplies the dark tile).
await writePng('ios-icon-dark.png', composeSvg({ size: 1024, scale: 0.66 }));
// iOS tinted: white glyph on transparent (system applies the tint).
await writePng('ios-icon-tinted.png', composeSvg({ size: 1024, scale: 0.66, mono: WHITE }));

// Android adaptive icon layers (mark stays inside the central safe zone).
await writePng('android-icon-foreground.png', composeSvg({ size: 1024, scale: 0.5 }));
await writePng('android-icon-background.png', composeSvg({ size: 1024, background: BACKGROUND, glow: true, scale: 0 }));
await writePng('android-icon-monochrome.png', composeSvg({ size: 1024, scale: 0.5, mono: WHITE }));

// Native splash mark (transparent, drawn on the splash backgroundColor).
await writePng('splash-icon.png', composeSvg({ size: 512, scale: 0.92 }));

// Web favicon.
await writePng('favicon.png', composeSvg({ size: 48, background: BACKGROUND, scale: 0.9 }));

console.log('done');
