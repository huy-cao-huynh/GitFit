import { StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Colors, Palette } from '@/constants/theme';

type GlowVariant = 'home' | 'cool' | 'warm' | 'session';

interface Glow {
  cx: string;
  cy: string;
  rx: string;
  ry: string;
  color: string;
  opacity: number;
}

/**
 * Ombre halos bleeding through the dark base — the "liquid glass" backdrop.
 * Render as the first child of a screen's root view (behind everything).
 */
const VARIANTS: Record<GlowVariant, Glow[]> = {
  home: [
    { cx: '50%', cy: '-5%', rx: '75%', ry: '35%', color: Palette.purple, opacity: 0.55 },
    { cx: '110%', cy: '35%', rx: '55%', ry: '30%', color: Palette.periwinkle, opacity: 0.22 },
    { cx: '-10%', cy: '85%', rx: '60%', ry: '35%', color: Palette.orange, opacity: 0.14 },
  ],
  cool: [
    { cx: '20%', cy: '-5%', rx: '70%', ry: '32%', color: Palette.purple, opacity: 0.5 },
    { cx: '95%', cy: '70%', rx: '55%', ry: '32%', color: Palette.periwinkle, opacity: 0.16 },
  ],
  warm: [
    { cx: '75%', cy: '-8%', rx: '70%', ry: '35%', color: Palette.orange, opacity: 0.3 },
    { cx: '-5%', cy: '45%', rx: '55%', ry: '30%', color: Palette.purple, opacity: 0.45 },
    { cx: '60%', cy: '105%', rx: '60%', ry: '30%', color: Palette.yellow, opacity: 0.12 },
  ],
  session: [
    { cx: '50%', cy: '-10%', rx: '80%', ry: '38%', color: Palette.purple, opacity: 0.6 },
    { cx: '105%', cy: '60%', rx: '55%', ry: '32%', color: Palette.redOrange, opacity: 0.14 },
    { cx: '-10%', cy: '95%', rx: '55%', ry: '30%', color: Palette.periwinkle, opacity: 0.2 },
  ],
};

export function GlowBackground({ variant = 'home' }: { variant?: GlowVariant }) {
  const glows = VARIANTS[variant];

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {glows.map((glow, index) => (
          <RadialGradient key={index} id={`glow-${variant}-${index}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={glow.color} stopOpacity={glow.opacity} />
            <Stop offset="70%" stopColor={glow.color} stopOpacity={glow.opacity * 0.35} />
            <Stop offset="100%" stopColor={glow.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={Colors.background} />
      {glows.map((glow, index) => (
        <Ellipse
          key={index}
          cx={glow.cx}
          cy={glow.cy}
          rx={glow.rx}
          ry={glow.ry}
          fill={`url(#glow-${variant}-${index})`}
        />
      ))}
    </Svg>
  );
}
