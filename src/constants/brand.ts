/**
 * GitFit brand mark: the "commit-graph dumbbell". A horizontal branch line
 * carrying four commit nodes — two large filled plates at the ends, two
 * smaller hollow commits inside — reads as both a git history and a dumbbell.
 * The right inner node is stroked volt: the current commit / today's rep.
 *
 * This geometry is the single source of truth for the in-app logo
 * (components/gitfit-logo.tsx). scripts/generate-brand-assets.mjs mirrors it
 * for PNG generation (icons/splash/favicon) — keep both in sync.
 */

export const LOGO_VIEWBOX = '0 0 128 128';
export const LOGO_SIZE = 128;

/**
 * The branch line (bar of the dumbbell) — a rounded rect, not a stroked line:
 * gradient paints on a zero-height line bounding box don't render.
 */
export const LOGO_BAR = { x: 14, y: 60, width: 100, height: 8, rx: 4 } as const;

/** Commit nodes, left to right. Hollow nodes render as thick rings. */
export const LOGO_NODES = [
  { cx: 22, cy: 64, r: 12, filled: true, accent: false },
  { cx: 46, cy: 64, r: 8, filled: false, accent: false },
  { cx: 82, cy: 64, r: 8, filled: false, accent: true },
  { cx: 106, cy: 64, r: 12, filled: true, accent: false },
] as const;

export const LOGO_RING_STROKE = 5;

export const WORDMARK = 'GitFit';
