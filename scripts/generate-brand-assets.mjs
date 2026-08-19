/**
 * Generates all GitFit brand PNGs (app icons, splash wordmark, favicon) from
 * the "GitFit" wordmark — "Git" white, "Fit" lime, on the near-black canvas.
 * Mirror of src/constants/brand.ts; keep the parts and tracking in sync.
 *
 * The glyphs are traced to SVG paths with opentype.js rather than handed to
 * sharp's text renderer: sharp/libvips resolves fonts through fontconfig, which
 * silently ignores a `fontfile` and falls back to one built-in face, so every
 * font produced byte-identical output. Tracing is deterministic and needs no
 * system font configuration.
 *
 * Usage: npm run generate:brand   (writes into assets/images/)
 */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'images');
const FONT_PATH = path.join(
  ROOT,
  'node_modules',
  '@expo-google-fonts',
  'manrope',
  '700Bold',
  'Manrope_700Bold.ttf',
);

// --- palette (mirror of src/constants/theme.ts) ---
const BACKGROUND = '#08080A';
const PRIMARY = '#D4F53C';
const WHITE = '#FFFFFF';

// --- wordmark (mirror of src/constants/brand.ts) ---
const PARTS = { neutral: 'Git', accent: 'Fit' };
const TRACKING = -0.02;
/** Arbitrary working em size — everything is rescaled to the target canvas. */
const GLYPH_SIZE = 1000;

let font;
try {
  const buffer = await readFile(FONT_PATH);
  font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
} catch (error) {
  console.error(`Could not read Manrope Bold at ${FONT_PATH}`);
  console.error('Run `npm install` first — the font ships with @expo-google-fonts/manrope.');
  throw error;
}

const glyphOptions = { kerning: true, letterSpacing: TRACKING };

/** The two halves of the wordmark as SVG paths, sharing one baseline at y=0. */
function wordmarkPaths() {
  const neutral = font.getPath(PARTS.neutral, 0, 0, GLYPH_SIZE, glyphOptions);
  const accentX = font.getAdvanceWidth(PARTS.neutral, GLYPH_SIZE, glyphOptions);
  const accent = font.getPath(PARTS.accent, accentX, 0, GLYPH_SIZE, glyphOptions);
  return { neutral, accent };
}

/** Ink bounds of the whole wordmark — the box we centre, so no optical nudge is needed. */
function inkBox({ neutral, accent }) {
  const a = neutral.getBoundingBox();
  const b = accent.getBoundingBox();
  return {
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    x2: Math.max(a.x2, b.x2),
    y2: Math.max(a.y2, b.y2),
  };
}

/**
 * Places the wordmark on a canvas of `width` x `height`, its ink box scaled to
 * `widthFraction` of the canvas width and centred both ways. `neutralColor` of
 * null draws nothing (used for the Android background layer).
 */
function composeSvg({
  width,
  height = width,
  background = null,
  widthFraction = 0.78,
  neutralColor = WHITE,
  accentColor = PRIMARY,
}) {
  const bg = background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : '';
  if (!neutralColor) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bg}</svg>`;
  }

  const paths = wordmarkPaths();
  const box = inkBox(paths);
  const markWidth = width * widthFraction;
  const factor = markWidth / (box.x2 - box.x1);
  const markHeight = (box.y2 - box.y1) * factor;
  const tx = (width - markWidth) / 2 - box.x1 * factor;
  const ty = (height - markHeight) / 2 - box.y1 * factor;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${bg}
    <g transform="translate(${tx} ${ty}) scale(${factor})">
      <path d="${paths.neutral.toPathData(2)}" fill="${neutralColor}"/>
      <path d="${paths.accent.toPathData(2)}" fill="${accentColor}"/>
    </g>
  </svg>`;
}

/** Canvas height that gives the wordmark `padding` breathing room at `widthFraction`. */
function tightHeight(width, widthFraction, padding) {
  const box = inkBox(wordmarkPaths());
  const aspect = (box.y2 - box.y1) / (box.x2 - box.x1);
  return Math.round(width * widthFraction * aspect * (1 + padding));
}

async function writePng(name, svg) {
  const file = path.join(OUT_DIR, name);
  await sharp(Buffer.from(svg)).png().toFile(file);
  const meta = await sharp(file).metadata();
  console.log(`wrote ${name} (${meta.width}x${meta.height})`);
}

await mkdir(OUT_DIR, { recursive: true });

// Main app icon + iOS light: wordmark on the flat near-black tile. No glow —
// the design language has no gradients.
const mainIcon = composeSvg({ width: 1024, background: BACKGROUND });
await writePng('icon.png', mainIcon);
await writePng('ios-icon-light.png', mainIcon);
// iOS dark: transparent background (the system supplies the dark tile).
await writePng('ios-icon-dark.png', composeSvg({ width: 1024 }));
// iOS tinted: single-colour wordmark on transparent (the system applies the tint).
await writePng(
  'ios-icon-tinted.png',
  composeSvg({ width: 1024, neutralColor: WHITE, accentColor: WHITE }),
);

// Android adaptive icon layers (wordmark stays inside the central safe zone,
// which is why the foreground is narrower than the iOS tile).
await writePng('android-icon-foreground.png', composeSvg({ width: 1024, widthFraction: 0.58 }));
await writePng(
  'android-icon-background.png',
  composeSvg({ width: 1024, background: BACKGROUND, neutralColor: null }),
);
await writePng(
  'android-icon-monochrome.png',
  composeSvg({ width: 1024, widthFraction: 0.58, neutralColor: WHITE, accentColor: WHITE }),
);

// Native splash wordmark: transparent and tightly cropped, so app.json's
// `imageWidth` maps almost directly to the wordmark's on-screen width.
const splashWidth = 1024;
const splashFraction = 0.94;
await writePng(
  'splash-icon.png',
  composeSvg({
    width: splashWidth,
    height: tightHeight(splashWidth, splashFraction, 0.35),
    widthFraction: splashFraction,
  }),
);

// Web favicon.
await writePng('favicon.png', composeSvg({ width: 48, background: BACKGROUND, widthFraction: 0.88 }));

console.log('done');
