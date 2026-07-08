/**
 * GitFit's brand palette: a single always-dark theme with soft ombre color
 * glows behind translucent "glass" surfaces — see AGENTS.md. Never responds
 * to the device's system light/dark setting.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  purple: '#3d348b', // background glows only — too dark for text/marks on near-black
  periwinkle: '#7678ed', // primary accent: CTAs, active tab, links
  yellow: '#f7b801',
  orange: '#f18701',
  redOrange: '#f35b04',
} as const;

export const Destructive = Palette.redOrange;

export const Colors = {
  text: '#F4F2FA',
  background: '#0D0B14',
  backgroundElement: 'rgba(255,255,255,0.06)',
  backgroundSelected: 'rgba(118,120,237,0.18)',
  textSecondary: '#8E8AA6',
  accent: Palette.periwinkle,
  accentLight: '#9B9DF2',
  border: 'rgba(255,255,255,0.10)',
} as const;

export type ThemeColor = keyof typeof Colors;

/** Warm ring hues, outermost first (move / workouts / cardio). */
export const RingColors = [Palette.redOrange, Palette.orange, Palette.yellow] as const;

export const Fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
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

/** Clearance for the floating pill tab bar (height 60 + margins + safe area overlap). */
export const BottomTabInset = 112;
export const MaxContentWidth = 800;
