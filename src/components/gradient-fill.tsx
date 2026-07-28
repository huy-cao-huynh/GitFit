import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export interface GradientStop {
  offset: number;
  color: string;
  /**
   * Stop alpha (0–1). Must be given separately: react-native-svg ignores the
   * alpha channel of an `rgba()` string in `stopColor`, so a translucent stop
   * written as rgba renders fully opaque.
   */
  opacity?: number;
}

/**
 * Absolute-fill gradient for CTA buttons, card accents, and glows. Parent
 * needs overflow:'hidden' + borderRadius. Defaults to the vertical primary →
 * primaryDark CTA fill; pass `stops` (e.g. from Gradients in theme.ts) for
 * multi-stop fills, `angle` (degrees clockwise, 0 = top→bottom) to tilt, or
 * `radial` for a center-out glow.
 */
export function GradientFill({
  from = Colors.primary,
  to = Colors.primaryDark,
  stops,
  angle = 0,
  radial = false,
}: {
  from?: string;
  to?: string;
  stops?: readonly GradientStop[];
  angle?: number;
  radial?: boolean;
}) {
  const id = useId();
  const resolvedStops: readonly GradientStop[] = stops ?? [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ];

  // Map the angle to a unit-square gradient axis through the center.
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians) / 2;
  const dy = Math.cos(radians) / 2;
  const axis = { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };

  const stopElements = resolvedStops.map((stop) => (
    <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
  ));

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 1 1">
      <Defs>
        {radial ? (
          <RadialGradient id={id} cx="0.5" cy="0.5" r="0.5">
            {stopElements}
          </RadialGradient>
        ) : (
          <LinearGradient id={id} {...axis}>
            {stopElements}
          </LinearGradient>
        )}
      </Defs>
      <Rect width={1} height={1} fill={`url(#${id})`} />
    </Svg>
  );
}
