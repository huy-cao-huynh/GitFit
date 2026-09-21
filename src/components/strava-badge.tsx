import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { StravaActivityLink } from '@/lib/store/types';

/**
 * "Imported from Strava" chip with an optional tap-through to the original
 * activity. Renders null for anything that isn't a synced/unlinked import --
 * an in-progress or failed export shouldn't read as "from Strava" on a
 * GitFit-originated workout.
 */
export function StravaBadge({ link }: { link: StravaActivityLink | undefined }) {
  if (!link || link.direction !== 'import') return null;

  const isUnlinked = link.uploadStatus === 'unlinked';
  const label = isUnlinked ? 'No longer on Strava' : 'Imported from Strava';
  const content = (
    <View style={[styles.chip, isUnlinked && styles.chipUnlinked]}>
      <ThemedText type="caption" themeColor={isUnlinked ? 'textMuted' : 'primary'}>
        {label}
      </ThemedText>
    </View>
  );

  if (!link.externalUrl || link.uploadStatus === 'unlinked') return content;

  return (
    <Pressable onPress={() => Linking.openURL(link.externalUrl!)} hitSlop={8}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    backgroundColor: Colors.primaryTint,
  },
  chipUnlinked: {
    backgroundColor: Colors.surfaceElevated,
  },
});
