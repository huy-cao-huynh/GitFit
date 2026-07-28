import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Big serif value + unit over a caption. `animatedValue` counts up instead of
 * rendering statically — both branches use the same face and size, so a stat
 * doesn't change typeface depending on which prop the caller reached for.
 */
export function SummaryStat({
  value,
  animatedValue,
  unit,
  label,
  centered,
}: {
  value?: string;
  animatedValue?: number;
  unit: string;
  label: string;
  centered?: boolean;
}) {
  return (
    <View style={[styles.stat, centered && styles.centered]}>
      {animatedValue !== undefined ? (
        <View style={styles.animatedRow}>
          <AnimatedNumber value={animatedValue} />
          {unit ? <ThemedText type="small">{unit}</ThemedText> : null}
        </View>
      ) : (
        <ThemedText type="stat">
          {value}
          {unit ? <ThemedText type="small"> {unit}</ThemedText> : null}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    gap: Spacing.half,
  },
  animatedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  centered: {
    alignItems: 'center',
  },
});
