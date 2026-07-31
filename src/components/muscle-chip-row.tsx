import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

const colors = Colors;

/** Wraps a routine's `muscleChipsFor` output as a chip row. Renders nothing for an empty list. */
export function MuscleChipRow({ muscles }: { muscles: string[] }) {
  if (muscles.length === 0) return null;

  return (
    <View style={styles.chipRow}>
      {muscles.map((muscle) => (
        <View key={muscle} style={styles.muscleChip}>
          <ThemedText type="caption">{muscle}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  muscleChip: {
    borderRadius: Radius.sm,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one,
  },
});
