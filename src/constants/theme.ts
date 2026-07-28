/**
 * GitFit's design language: "Electric. Editorial. Alive." A single fixed
 * near-black dark theme (never follows the OS setting) with an electric blue
 * primary family and a volt-lime accent reserved for streaks, PRs, and
 * success highlights. Depth comes from radial screen glows, subtle dot-grid
 * texture, and gradients (via ScreenBackground / GradientFill) — backgrounds
 * are allowed to glow, but cards stay opaque with thin borders; still no
 * glassmorphism or drop shadows. Type mixes three voices: Manrope for body,
 * Fraunces (serif) for display/headings, DSEG7 for timers and big counters.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  text: '#F7F8FD',
  textSecondary: '#7A8399',
  /** Inactive/decorative labels only — never body copy. */
  textMuted: '#6D7485',
  /** Near-black with a slight blue cast. */
  background: '#08080D',
  /** Opaque card surface. */
  surface: '#14141B',
  /** Raised controls: steppers, segmented tracks, dropdowns, active tab pill. */
  surfaceElevated: '#1E1E28',
  /** Electric blue — fills and text (≈5.2:1 on background, passes AA). */
  primary: '#3D8BFD',
  /** Small accent text, links, icons (≈8.5:1 on background). */
  primaryLight: '#7EB3FF',
  /** Dark stop for primary gradients. */
  primaryDark: '#1D4ED8',
  /** Volt lime — streaks, PRs, success highlights, inverted cards. Dark text on volt fills. */
  volt: '#D4F53C',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  /** Blue-tinted hairline border. */
  border: 'rgba(120,160,255,0.10)',
  /** Subtle primary-tinted chip/tile backgrounds. */
  primaryTint: 'rgba(61,139,253,0.16)',
  /** Radial screen-glow fills (ScreenBackground). */
  glow: 'rgba(61,139,253,0.16)',
} as const;

export type ThemeColor = keyof typeof Colors;

/**
 * Ring hues, outermost first. One goal ring is added/removed per active
 * modular goal on the Dashboard; colors cycle if more goals than hues are
 * active. Alternates hue families so adjacent rings read apart.
 */
export const RingColors = [Colors.primaryLight, Colors.volt, Colors.primary, Colors.warning] as const;

/** Per-metric chart series colors — one series per chart. */
export const ChartColors = {
  steps: Colors.primaryLight,
  calories: Colors.warning,
  cardio: Colors.volt,
  water: Colors.primary,
  bodyweight: Colors.primaryLight,
  strength: Colors.primary,
} as const;

/**
 * Multi-stop gradient definitions consumed by GradientFill (stops prop).
 * Angles are degrees clockwise from "up" (0° = bottom→top light direction).
 */
export const Gradients = {
  /** Primary CTA buttons. */
  cta: [
    { offset: 0, color: Colors.primary },
    { offset: 1, color: Colors.primaryDark },
  ],
  /** Hero CTA (Start Workout): volt-tinged top edge into the blue family. */
  ctaHero: [
    { offset: 0, color: '#5CB0FF' },
    { offset: 0.55, color: Colors.primary },
    { offset: 1, color: Colors.primaryDark },
  ],
  /** Radial top-of-screen glow (ScreenBackground). */
  screenGlow: [
    { offset: 0, color: Colors.glow },
    { offset: 1, color: 'rgba(61,139,253,0)' },
  ],
  /** Faint accent wash for card edges/icon tiles. */
  cardAccent: [
    { offset: 0, color: Colors.primaryTint },
    { offset: 1, color: 'rgba(61,139,253,0)' },
  ],
} as const;

/** Corner radii: cards lg, buttons/inputs md, inner chips/segments sm, circles/pills full. */
export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
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
  /** Fraunces serif — display headings and screen titles. */
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  /** Italic serif for emphasis words inside display copy. */
  displayItalic: 'Fraunces_600SemiBold_Italic',
  /** DSEG7 seven-segment — timers and big counters (fixed-width digits). */
  timer: 'DSEG7Classic-Bold',
  timerLight: 'DSEG7Classic-Regular',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

/** Type scale — ThemedText variants read from here; no per-screen font sizes. */
export const Type = {
  display: { fontFamily: Fonts.display, fontSize: 40, lineHeight: 48 },
  title: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 40 },
  heading: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
  timerLg: { fontFamily: Fonts.timer, fontSize: 44, lineHeight: 52 },
  timerSm: { fontFamily: Fonts.timerLight, fontSize: 24, lineHeight: 30 },
  numeric: { fontFamily: Fonts.timer, fontSize: 28, lineHeight: 34 },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Clearance for the floating tab bar (height 64 + float gap + home-indicator safe area). */
export const BottomTabInset = 120;
export const MaxContentWidth = 800;
