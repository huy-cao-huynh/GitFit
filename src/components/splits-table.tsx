import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { CardioSplit } from '@/lib/cardio-math';
import type { UnitSystem } from '@/lib/store/types';
import { distanceUnitLabel, formatPace, toDisplayDistance, toDisplayElevation } from '@/lib/units';

/** Slowest split anchors the bar at this width, so every row still shows one. */
const MIN_BAR_FRACTION = 0.25;

export interface SplitsTableProps {
  splits: CardioSplit[];
  unitSystem: UnitSystem;
}

/**
 * One row per mile or kilometre. Each row carries a bar scaled to its pace
 * against the slowest split, so the shape of the run — where you faded, where
 * you pushed — reads without parsing any numbers. The fastest full split is
 * lime.
 */
export function SplitsTable({ splits, unitSystem }: SplitsTableProps) {
  if (splits.length < 2) return null;

  const full = splits.filter((split) => !split.partial);
  const fastest = full.length ? Math.min(...full.map((split) => split.secPerMile)) : 0;
  const slowest = Math.max(...splits.map((split) => split.secPerMile));
  const unit = distanceUnitLabel(unitSystem);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="label">SPLITS</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          per {unit}
        </ThemedText>
      </View>

      {splits.map((split) => {
        const isFastest = !split.partial && split.secPerMile === fastest;
        // Faster splits get longer bars, so the eye reads "further right = better".
        const fraction = slowest > 0 ? fastest / split.secPerMile : 1;
        const width = `${Math.max(MIN_BAR_FRACTION, fraction) * 100}%` as const;

        return (
          <View key={split.index} style={styles.row}>
            <ThemedText type="statInline" themeColor="textSecondary" style={styles.index}>
              {split.partial
                ? toDisplayDistance(split.distanceMiles, unitSystem).toFixed(2)
                : split.index}
            </ThemedText>

            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width },
                  isFastest ? styles.barFastest : undefined,
                  split.partial ? styles.barPartial : undefined,
                ]}
              />
            </View>

            <ThemedText
              type="statInline"
              themeColor={isFastest ? 'primary' : 'text'}
              style={styles.pace}>
              {formatPaceValue(split.secPerMile, unitSystem)}
            </ThemedText>

            <ThemedText type="small" themeColor="textSecondary" style={styles.climb}>
              {split.elevationGainFt >= 1 ? `+${toDisplayElevation(split.elevationGainFt, unitSystem)}` : '—'}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/** formatPace appends the unit; the column header already carries it. */
function formatPaceValue(secPerMile: number, unitSystem: UnitSystem): string {
  return formatPace(secPerMile, unitSystem).split(' ')[0];
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  index: {
    width: 34,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Radius.sm,
    backgroundColor: Colors.textSecondary,
  },
  barFastest: {
    backgroundColor: Colors.primary,
  },
  barPartial: {
    backgroundColor: Colors.textMuted,
  },
  pace: {
    width: 52,
    textAlign: 'right',
  },
  climb: {
    width: 40,
    textAlign: 'right',
  },
});
