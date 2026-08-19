/**
 * GitFit brand mark: a text-only wordmark. No glyph, no logo — just "GitFit"
 * set in Manrope Bold on the near-black canvas, with the two halves split by
 * colour: "Git" white, "Fit" lime.
 *
 * This file is the single source of truth for both renderers:
 *   - components/wordmark.tsx  — the in-app mark (real text, Manrope loaded)
 *   - scripts/generate-brand-assets.mjs — the PNGs (glyphs traced to paths,
 *     since a build script has no font loader)
 * Keep them in sync; regenerate rather than hand-editing assets/images/*.png.
 */

export const WORDMARK = 'GitFit';

/** The wordmark split at the colour boundary. Order matters — concatenating these must equal WORDMARK. */
export const WORDMARK_PARTS = { neutral: 'Git', accent: 'Fit' } as const;

/**
 * Tracking as a fraction of font size. Manrope's default spacing is loose for
 * a six-letter mark, so it's pulled in slightly to read as one unit.
 */
export const WORDMARK_TRACKING = -0.02;
