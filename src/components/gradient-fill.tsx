import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/**
 * Vertical primary gradient fill for primary CTA buttons — the only sanctioned
 * gradient on interactive surfaces. Parent needs overflow:'hidden' + borderRadius.
 */
export function GradientFill({ from = Colors.primary, to = Colors.primaryDark }: { from?: string; to?: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 1 1">
      <Defs>
        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect width={1} height={1} fill="url(#fill)" />
    </Svg>
  );
}
