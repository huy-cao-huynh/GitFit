import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { cardioElevationProfile } from '@/lib/cardio-math';
import { smoothLinePath } from '@/lib/chart-path';
import type { GpsPoint, UnitSystem } from '@/lib/store/types';
import { elevationUnitLabel, toDisplayElevation } from '@/lib/units';

const PADDING = 6;
/** Flat runs still deserve a readable band rather than a line pinned to the floor. */
const MIN_RANGE_FT = 30;
const AREA_OPACITY = 0.16;

export interface ElevationProfileProps {
  route: GpsPoint[];
  width: number;
  height?: number;
  unitSystem: UnitSystem;
  gainFt?: number;
  /** Hide the header row when the caller draws its own. */
  bare?: boolean;
}

/**
 * Altitude against cumulative distance. X is real distance, not sample index,
 * so a stretch where fixes came in slowly doesn't stretch across the chart.
 *
 * The area is a flat low-opacity lime fill rather than a gradient, per the
 * flat-colour rule in the design language.
 */
export function ElevationProfile({
  route,
  width,
  height = 88,
  unitSystem,
  gainFt,
  bare = false,
}: ElevationProfileProps) {
  const profile = cardioElevationProfile(route);
  if (profile.length < 2 || width <= 0) return null;

  const totalDistance = profile[profile.length - 1].distanceMiles;
  if (totalDistance <= 0) return null;

  const altitudes = profile.map((point) => point.altitudeFt);
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const range = Math.max(max - min, MIN_RANGE_FT);
  // Centre a flat profile in the band instead of letting it ride the bottom.
  const floor = min - (range - (max - min)) / 2;

  const innerWidth = width - PADDING * 2;
  const innerHeight = height - PADDING * 2;
  const coords = profile.map((point) => ({
    cx: PADDING + (point.distanceMiles / totalDistance) * innerWidth,
    cy: PADDING + innerHeight - ((point.altitudeFt - floor) / range) * innerHeight,
  }));

  const line = smoothLinePath(coords);
  const baseline = height - PADDING;
  const area = `${line} L ${coords[coords.length - 1].cx},${baseline} L ${coords[0].cx},${baseline} Z`;

  return (
    <View style={styles.container}>
      {bare ? null : (
        <View style={styles.header}>
          <ThemedText type="label">ELEVATION</ThemedText>
          {gainFt ? (
            <ThemedText type="statInline">
              +{toDisplayElevation(gainFt, unitSystem)} {elevationUnitLabel(unitSystem)}
            </ThemedText>
          ) : null}
        </View>
      )}
      <Svg width={width} height={height}>
        <Path d={area} fill={Colors.primary} fillOpacity={AREA_OPACITY} />
        <Path d={line} stroke={Colors.primary} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
