import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/**
 * Full-screen backdrop: neutral near-black base under a print-halftone dot
 * field that grades from coarse at the top-left to fine at the bottom-right.
 * The falloff is done by painting a scrim in the background colour over the
 * coarse layer rather than with an SVG <Mask>, which is better supported.
 *
 * There is deliberately no colour wash here — the old radial glow sat directly
 * behind screen headers and hurt legibility. Wrap a screen's content in this
 * (flex: 1); the SVG layer is static and pointer-transparent.
 */
export function ScreenBackground({ children }: { children?: ReactNode }) {
  const fineId = useId();
  const coarseId = useId();
  const scrimId = useId();

  return (
    <View style={styles.container}>
      {/* No viewBox: user units are px, so the dot pitch stays physically
          constant instead of stretching with the screen's aspect ratio. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id={fineId} patternUnits="userSpaceOnUse" width="22" height="22">
            <Circle cx="11" cy="11" r="0.9" fill={Colors.dot} />
          </Pattern>
          <Pattern id={coarseId} patternUnits="userSpaceOnUse" width="22" height="22">
            <Circle cx="11" cy="11" r="1.7" fill={Colors.dot} />
          </Pattern>
          <LinearGradient id={scrimId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={Colors.background} stopOpacity="0" />
            <Stop offset="0.6" stopColor={Colors.background} stopOpacity="1" />
            <Stop offset="1" stopColor={Colors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Coarse dots, then a scrim that dissolves them toward the bottom-right,
            then the fine dots on top so they survive across the whole screen. */}
        <Rect width="100%" height="100%" fill={`url(#${coarseId})`} />
        <Rect width="100%" height="100%" fill={`url(#${scrimId})`} />
        <Rect width="100%" height="100%" fill={`url(#${fineId})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
