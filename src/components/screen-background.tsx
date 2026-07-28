import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Pattern, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/**
 * Full-screen backdrop: near-black base, a radial glow bleeding down from the
 * top, and optionally a faint dot-grid texture and/or angular corner shapes.
 * Wrap a screen's content in it (flex: 1); the SVG layers are static and
 * pointer-transparent.
 */
export function ScreenBackground({
  pattern,
  shapes = false,
  children,
}: {
  pattern?: 'dots';
  shapes?: boolean;
  children?: ReactNode;
}) {
  const glowId = useId();
  const dotsId = useId();

  return (
    <View style={styles.container}>
      <Svg
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={Colors.glow} />
            <Stop offset="1" stopColor="rgba(61,139,253,0)" />
          </RadialGradient>
        </Defs>
        {shapes ? (
          <>
            <Polygon points="70,0 100,0 100,26" fill={Colors.primaryTint} opacity={0.5} />
            <Polygon points="0,78 0,100 18,100" fill={Colors.primaryTint} opacity={0.35} />
          </>
        ) : null}
        <Ellipse cx="50" cy="4" rx="72" ry="38" fill={`url(#${glowId})`} />
      </Svg>
      {pattern === 'dots' ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <Pattern id={dotsId} patternUnits="userSpaceOnUse" width="24" height="24">
              <Circle cx="12" cy="12" r="1" fill="rgba(255,255,255,0.03)" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${dotsId})`} />
        </Svg>
      ) : null}
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
