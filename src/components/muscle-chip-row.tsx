import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

const colors = Colors;

/** 'upper-back' -> 'Upper Back'. */
function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Chip row of Anatome muscle slugs, humanized for display. Renders nothing for an empty list. */
export function MuscleChipRow({ slugs }: { slugs: string[] }) {
  if (slugs.length === 0) return null;

  return (
    <View style={styles.chipRow}>
      {slugs.map((slug) => (
        <View key={slug} style={styles.muscleChip}>
          <ThemedText type="caption">{humanizeSlug(slug)}</ThemedText>
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
