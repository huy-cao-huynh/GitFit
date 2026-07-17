/**
 * GitFit's design language: "Precision. Focus. Momentum." A single fixed
 * matte-charcoal dark theme (never follows the OS setting) — opaque surfaces,
 * thin borders instead of shadows or glows, one blue primary family, and
 * green/amber reserved for semantic accents. Gradients appear only on
 * progress rings, progress bars, charts, primary CTAs, and PR/achievement
 * indicators — never on backgrounds, cards, or text.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  text: '#F4F6FB',
  textSecondary: '#737b8c',
  /** Inactive/decorative labels only (4.05:1 on background) — never body copy. */
  textMuted: '#6D7485',
  background: '#121212',
  /** Opaque matte card surface. */
  surface: '#1C1C1E',
  /** Raised controls: steppers, segmented tracks, dropdowns, active tab pill. */
  surfaceElevated: '#25252B',
  /** Fills and large/bold text only — 3.7:1 on background fails for small text. */
  primary: '#2563EB',
  /** Small accent text, links, icons (7.5:1 on background). */
  primaryLight: '#60A5FA',
  /** Dark stop for primary gradients. */
  primaryDark: '#1D4ED8',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: 'rgba(255,255,255,0.08)',
  /** Subtle primary-tinted chip/tile backgrounds. */
  primaryTint: 'rgba(37,99,235,0.18)',
} as const;

export type ThemeColor = keyof typeof Colors;

/**
 * Ring hues, outermost first. One goal ring is added/removed per active
 * modular goal on the Dashboard; colors cycle if more goals than hues are
 * active. Alternates hue families so adjacent rings read apart.
 */
export const RingColors = [Colors.primaryLight, Colors.success, Colors.primary, Colors.warning] as const;

/** Per-metric chart series colors — one series per chart. */
export const ChartColors = {
  steps: Colors.primaryLight,
  calories: Colors.warning,
  cardio: Colors.success,
  water: Colors.primary,
  bodyweight: Colors.primaryLight,
  strength: Colors.primary,
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
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
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

/** Clearance for the anchored tab bar (height 56 + home-indicator safe area). */
export const BottomTabInset = 96;
export const MaxContentWidth = 800;
