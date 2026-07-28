import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Big value + unit over a caption. `animatedValue` counts up in the DSEG face instead. */
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
          {unit ? (
            <ThemedText type="small" themeColor="textSecondary">
              {unit}
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <ThemedText type="subtitle" style={styles.value}>
          {value}
          {unit ? (
            <ThemedText type="small" themeColor="textSecondary">
              {' '}
              {unit}
            </ThemedText>
          ) : null}
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
  value: {
    fontSize: 26,
    lineHeight: 30,
  },
});
