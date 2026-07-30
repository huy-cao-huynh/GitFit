import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MUSCLE_COVERAGE_GROUPS } from '@/lib/store/derive';

const colors = Colors;

export function MuscleCoverageBar({ hit }: { hit: Set<string> }) {
  return (
    <ThemedView type="surface" style={styles.card}>
      <ThemedText type="label" style={styles.label}>
        TRAINED THIS WEEK
      </ThemedText>
      <View style={styles.chipRow}>
        {MUSCLE_COVERAGE_GROUPS.map((group) => {
          const active = hit.has(group);
          return (
            <View key={group} style={[styles.chip, active && styles.chipActive]}>
              <ThemedText type="small" themeColor={active ? 'primary' : 'textSecondary'}>
                {group}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  label: {
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: 'transparent',
    backgroundColor: colors.primaryTint,
  },
});
