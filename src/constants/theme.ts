/**
 * GitFit's design language: "Lime. Editorial. Grounded." A single fixed
 * near-black dark theme (never follows the OS setting) built on one accent —
 * electric lime — plus a neutral grey ramp for data. Cards are defined by a
 * flat grey fill, never by a stroke; the only background decoration is a
 * print-halftone dot field that grades from lime to neutral. Colour is always
 * flat — no gradients, no glassmorphism, no drop shadows, no washes behind text.
 *
 * Type has three voices with strict jobs:
 *   - Manrope (sans)   — body copy, labels, buttons, list rows. The default.
 *   - Fraunces (serif) — headers, standout copy, and EVERY number that isn't a
 *                        live timer (stats, targets, chart axes, counters).
 *   - DSEG7 (LCD)      — live workout/cardio timers and in-session distance
 *                        ONLY. See the allow-list in AGENTS.md.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

export const Colors = {
  text: '#F4F5F2',
  /** Labels, captions, eyebrows — ≈9.4:1 on background. Never a value. */
  textSecondary: '#A9AEB8',
  /** Disabled/inactive state only (dimmed icons, placeholder borders). */
  textMuted: '#878D99',
  /** Neutral near-black. */
  background: '#08080A',
  /** Card surface — cards carry no stroke, so this fill is what defines them. */
  surface: '#16161A',
  /** Raised controls: steppers, segmented tracks, inputs, dropdowns. */
  surfaceElevated: '#212127',
  /** The grounded tab-bar plinth — a step below the canvas. */
  tabBarBackground: '#000000',
  /** Electric lime — the one accent (≈17:1 on background). */
  primary: '#D4F53C',
  /** Lighter lime for small icons and links. */
  primaryLight: '#E6FF85',
  /** Gradient dark stop / pressed state. */
  primaryDark: '#9DBF1F',
  /** Text and icons on ANY lime fill — never use `text` on lime. */
  onPrimary: '#08080A',
  /** Secondary text on a lime fill (labels, captions inside an inverted card). */
  onPrimaryDim: 'rgba(8,8,10,0.65)',
  /** Empty/track marks on a lime fill (inverted contribution grid cells). */
  onPrimaryFaint: 'rgba(8,8,10,0.14)',
  success: '#D4F53C',
  /** Semantic only (over-target calories) — never a chart series. */
  warning: '#F5A524',
  danger: '#FF5A52',
  /**
   * Neutral hairline. Structural only — dividers, inputs, and controls whose
   * outline IS the control. Cards do not use it; they use a `surface` fill.
   */
  border: 'rgba(255,255,255,0.10)',
  /** Subtle lime chip/tile backgrounds. */
  primaryTint: 'rgba(212,245,60,0.14)',
  /**
   * Halftone dot ramp (ScreenBackground), coarse to fine: the big dots at the
   * top-left carry lime and desaturate to neutral as they shrink.
   */
  dotAccent: 'rgba(212,245,60,0.13)',
  dotMid: 'rgba(190,220,110,0.09)',
  dot: 'rgba(244,245,242,0.055)',
} as const;

export type ThemeColor = keyof typeof Colors;

/**
 * Ring hues, outermost first. One goal ring is added/removed per active
 * modular goal on the Dashboard; colors cycle if more goals than hues are
 * active. Lime headlines the stack, neutrals recede behind it.
 */
export const RingColors = ['#D4F53C', '#F4F5F2', '#8E94A2', '#5A5F6B'] as const;

/**
 * Per-metric chart series colors — one series per chart. The rule: effort
 * metrics you push on are lime, measurements you merely record are neutral.
 */
export const ChartColors = {
  steps: Colors.primary,
  cardio: Colors.primary,
  strength: Colors.primary,
  calories: Colors.text,
  water: Colors.textSecondary,
  bodyweight: Colors.text,
} as const;

/**
 * Corner radii: cards lg, buttons/inputs md, inner chips/segments sm,
 * circles/pills full. Deliberately tight — containers read as rectangles with
 * the corner burr knocked off, not as pills.
 */
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  full: 999,
} as const;

/** Animation durations (ms) — always withTiming, never springs. */
export const Motion = {
  fast: 150,
  base: 200,
  slow: 250,
} as const;

export const Fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  /** Fraunces serif — headers, standout copy, and all non-timer numerals. */
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  /** Italic serif for emphasis words inside display copy. */
  displayItalic: 'Fraunces_600SemiBold_Italic',
  /** DSEG7 seven-segment — live timers and in-session distance ONLY. */
  timer: 'DSEG7Classic-Bold',
  timerLight: 'DSEG7Classic-Regular',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

/**
 * Fixed-width figures so count-ups and live values don't reflow. Fraunces'
 * static build may not ship `tnum`, in which case this is a harmless no-op.
 */
const tabular: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

/** Type scale — ThemedText variants read from here; no per-screen font sizes. */
export const Type = {
  display: { fontFamily: Fonts.displayBold, fontSize: 40, lineHeight: 46 },
  title: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 38 },
  heading: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28 },
  /** Uppercase section eyebrows ("TODAY", "WEEKLY GOALS") — full-contrast white. */
  label: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: 1.2 },
  /** CTA labels — buttons stay sans even though headers are serif. */
  button: { fontFamily: Fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
  /** Serif numerals — every number that isn't a live timer. */
  statLg: { fontFamily: Fonts.displayBold, fontSize: 40, lineHeight: 44, ...tabular },
  statMd: { fontFamily: Fonts.displayBold, fontSize: 28, lineHeight: 32, ...tabular },
  statSm: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 24, ...tabular },
  /** Numerals sitting inline in a sans text row (legends, list rows, chips). */
  statXs: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, ...tabular },
  /** DSEG7 — workout/cardio timers and in-session distance only. */
  timerLg: { fontFamily: Fonts.timer, fontSize: 44, lineHeight: 52 },
  timerSm: { fontFamily: Fonts.timerLight, fontSize: 24, lineHeight: 30 },
  /** Compact readout — the in-session total-elapsed timer. */
  timerXs: { fontFamily: Fonts.timerLight, fontSize: 16, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Height of the tab bar block itself, above the home-indicator safe area. */
export const TabBarHeight = 52;
/** Clearance for the grounded tab bar: bar + home-indicator area + breathing room. */
export const BottomTabInset = TabBarHeight + 56;
export const MaxContentWidth = 800;
