import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { WaterBottle } from '@/components/water-bottle';
import { Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { toDisplayVolume, volumeUnitLabel } from '@/lib/units';
import type { UnitSystem } from '@/lib/store/types';

const colors = Colors;

/**
 * The dashboard's water widget — a checkmark pops in at the top-right corner
 * (mirroring DailyGoalsCard's streak-flame pop) the moment today's total
 * crosses the daily target; a ref guards the haptic so it only fires once
 * per crossing, not on every quick-add already past goal.
 */
export function WaterGoalCard({
  current,
  target,
  unitSystem,
  quickAddDisplay,
  onAdd,
}: {
  current: number;
  target: number;
  unitSystem: UnitSystem;
  quickAddDisplay: number;
  onAdd: () => void;
}) {
  const metGoal = target > 0 && current >= target;
  const previousMet = useRef(false);
  const check = useSharedValue(0);

  useEffect(() => {
    check.set(withTiming(metGoal ? 1 : 0, { duration: Motion.base }));
    if (metGoal && !previousMet.current) {
      haptics.notification(Haptics.NotificationFeedbackType.Success);
    }
    previousMet.current = metGoal;
  }, [metGoal, check]);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.get(),
    transform: [{ scale: check.get() }],
  }));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <ThemedText type="caption" themeColor="textSecondary">
          WATER
        </ThemedText>
        <Animated.View style={checkStyle}>
          <SymbolView name="checkmark.circle.fill" size={16} tintColor={colors.primary} />
        </Animated.View>
      </View>
      <WaterBottle progress={target > 0 ? current / target : 0} size={44} />
      <ThemedText type="statInline">
        {toDisplayVolume(current, unitSystem)}
        <ThemedText type="small" themeColor="textSecondary">
          /{toDisplayVolume(target, unitSystem)} {volumeUnitLabel(unitSystem)}
        </ThemedText>
      </ThemedText>
      <Pressable style={({ pressed }) => [styles.waterAdd, pressed && styles.waterAddPressed]} onPress={onAdd}>
        <ThemedText type="caption" themeColor="onPrimary">
          +{quickAddDisplay} {volumeUnitLabel(unitSystem)}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  headerRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waterAdd: {
    borderRadius: Radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  waterAddPressed: {
    backgroundColor: colors.primaryDark,
  },
});
