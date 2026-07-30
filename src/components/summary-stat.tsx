import type { SFSymbol } from 'expo-symbols';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

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
  icon,
  centered,
}: {
  value?: string;
  animatedValue?: number;
  unit: string;
  label: string;
  icon?: SFSymbol;
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
      <View style={styles.labelRow}>
        {icon ? <SymbolView name={icon} size={11} tintColor={Colors.textSecondary} /> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  centered: {
    alignItems: 'center',
  },
});
