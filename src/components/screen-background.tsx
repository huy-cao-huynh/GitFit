import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/**
 * Full-screen backdrop: neutral near-black base under a print-halftone dot
 * field. Three tiers of dot run coarse-and-lime at the top-left through to
 * fine-and-neutral at the bottom-right, so size and saturation fall off
 * together. Each tier is painted, then dissolved by a scrim in the background
 * colour before the next one goes down — that's the falloff, done without an
 * SVG <Mask> (which is poorly supported in react-native-svg).
 *
 * There is deliberately no colour wash here — the old radial glow sat directly
 * behind screen headers and hurt legibility. If the lime reads as busy, lower
 * Colors.dotAccent's alpha rather than changing the pitch. Wrap a screen's
 * content in this (flex: 1); the SVG layer is static and pointer-transparent.
 */
export function ScreenBackground({ children }: { children?: ReactNode }) {
  const coarseId = useId();
  const midId = useId();
  const fineId = useId();
  const scrimAId = useId();
  const scrimBId = useId();

  return (
    <View style={styles.container}>
      {/* No viewBox: user units are px, so the dot pitch stays physically
          constant instead of stretching with the screen's aspect ratio. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id={coarseId} patternUnits="userSpaceOnUse" width="22" height="22">
            <Circle cx="11" cy="11" r="1.9" fill={Colors.dotAccent} />
          </Pattern>
          <Pattern id={midId} patternUnits="userSpaceOnUse" width="22" height="22">
            <Circle cx="11" cy="11" r="1.3" fill={Colors.dotMid} />
          </Pattern>
          <Pattern id={fineId} patternUnits="userSpaceOnUse" width="22" height="22">
            <Circle cx="11" cy="11" r="0.85" fill={Colors.dot} />
          </Pattern>
          <LinearGradient id={scrimAId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={Colors.background} stopOpacity="0" />
            <Stop offset="0.35" stopColor={Colors.background} stopOpacity="1" />
            <Stop offset="1" stopColor={Colors.background} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id={scrimBId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0.3" stopColor={Colors.background} stopOpacity="0" />
            <Stop offset="0.7" stopColor={Colors.background} stopOpacity="1" />
            <Stop offset="1" stopColor={Colors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Each scrim erases everything painted before it, so only the later
            (smaller, greyer) tiers survive down-and-right. */}
        <Rect width="100%" height="100%" fill={`url(#${coarseId})`} />
        <Rect width="100%" height="100%" fill={`url(#${scrimAId})`} />
        <Rect width="100%" height="100%" fill={`url(#${midId})`} />
        <Rect width="100%" height="100%" fill={`url(#${scrimBId})`} />
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
