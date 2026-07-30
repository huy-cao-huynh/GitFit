import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

/** Inline segmented control for picking a chart time range (e.g. Week/Month/All time). */
export function RangeToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onChange(option.id);
            }}>
            <ThemedText
              type="small"
              themeColor={active ? 'primary' : 'textSecondary'}
              style={active ? styles.activeLabel : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: 2,
    gap: 2,
  },
  segment: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
  },
  segmentActive: {
    backgroundColor: Colors.surface,
  },
  activeLabel: {
    fontFamily: Fonts.bold,
  },
});
