import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ElevationProfile } from '@/components/elevation-profile';
import { RouteMap } from '@/components/route-map';
import { SplitsTable } from '@/components/splits-table';
import { SummaryStat } from '@/components/summary-stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { cardioSplits } from '@/lib/cardio-math';
import type { CardioSession, UnitSystem } from '@/lib/store/types';
import {
  distanceUnitLabelForActivity,
  elevationUnitLabel,
  formatPace,
  toDisplayDistanceForActivity,
  toDisplayElevation,
} from '@/lib/units';

export interface CardioSummaryProps {
  session: CardioSession;
  unitSystem: UnitSystem;
  /** Count the headline numbers up on arrival — the just-finished screen only. */
  animated?: boolean;
}

/**
 * Everything a finished cardio session has to say: the route, the numbers, the
 * elevation profile and the splits. Shared by the post-workout screen and the
 * history detail so the two can't drift apart.
 *
 * All serif — DSEG7 is for clocks that are still running, and none of these are.
 */
export function CardioSummary({ session, unitSystem, animated = false }: CardioSummaryProps) {
  const [contentWidth, setContentWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setContentWidth(event.nativeEvent.layout.width);

  const route = session.route ?? [];
  const hasRoute = route.length > 1;
  const splits = hasRoute ? cardioSplits(route, unitSystem) : [];

  return (
    <View style={styles.container} onLayout={onLayout}>
      {hasRoute ? (
        <ThemedView type="surface" style={styles.mapCard}>
          <RouteMap route={route} />
        </ThemedView>
      ) : null}

      <ThemedView type="surface" style={styles.statCard}>
        <View style={styles.statRow}>
          <SummaryStat
            value={`${session.minutes}`}
            animatedValue={animated ? session.minutes : undefined}
            unit="min"
            label="Duration"
          />
          {session.distanceMiles ? (
            <SummaryStat
              value={`${toDisplayDistanceForActivity(session.distanceMiles, session.activityType, unitSystem)}`}
              unit={distanceUnitLabelForActivity(session.activityType, unitSystem)}
              label="Distance"
            />
          ) : null}
          <SummaryStat
            value={`${session.calories ?? 0}`}
            animatedValue={animated ? (session.calories ?? 0) : undefined}
            unit="cal"
            label="Calories"
          />
        </View>

        {session.avgPaceSecPerMile || session.elevationGainFt ? (
          <View style={[styles.statRow, styles.secondRow]}>
            {session.avgPaceSecPerMile ? (
              <SummaryStat value={formatPace(session.avgPaceSecPerMile, unitSystem)} unit="" label="Avg pace" />
            ) : null}
            {session.elevationGainFt ? (
              <SummaryStat
                value={`${toDisplayElevation(session.elevationGainFt, unitSystem)}`}
                unit={elevationUnitLabel(unitSystem)}
                label="Elevation gain"
              />
            ) : null}
          </View>
        ) : null}
      </ThemedView>

      {hasRoute && contentWidth > 0 ? (
        <ThemedView type="surface" style={styles.card}>
          <ElevationProfile
            route={route}
            width={contentWidth - Spacing.three * 2}
            unitSystem={unitSystem}
            gainFt={session.elevationGainFt}
          />
        </ThemedView>
      ) : null}

      {splits.length > 1 ? (
        <ThemedView type="surface" style={styles.card}>
          <SplitsTable splits={splits} unitSystem={unitSystem} />
        </ThemedView>
      ) : null}

      {hasRoute ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          No route was recorded for this session.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  mapCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  statCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondRow: {
    justifyContent: 'flex-start',
    gap: Spacing.five,
  },
});
