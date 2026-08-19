import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { allGoalsStreak } from '@/lib/store/derive';
import type { CheckoffDef, CheckoffLog } from '@/lib/store/types';

const colors = Colors;

/**
 * Today's daily check-offs. The card is a fixed height so a long goal list
 * scrolls inside it instead of stretching the bento row; the streak badge
 * counts consecutive days where every goal was ticked off, and pops when it
 * changes.
 */
export function DailyGoalsCard({
  defs,
  doneToday,
  checkoffLog,
  onToggle,
}: {
  defs: CheckoffDef[];
  doneToday: string[];
  checkoffLog: CheckoffLog;
  onToggle: (defId: string) => void;
}) {
  const total = defs.length;
  const done = defs.filter((def) => doneToday.includes(def.id)).length;
  const streak = allGoalsStreak(defs, checkoffLog);

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(total > 0 ? done / total : 0, { duration: Motion.base }));
  }, [done, total, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  // The flame arrives first, then the label slides out from behind it. Runs on
  // mount and whenever the streak changes — not on every render, or unrelated
  // store updates would replay it.
  const flame = useSharedValue(0);
  const reveal = useSharedValue(0);
  const previousStreak = useRef(-1);
  useEffect(() => {
    if (previousStreak.current === streak) return;
    previousStreak.current = streak;
    if (streak <= 0) {
      flame.set(0);
      reveal.set(0);
      return;
    }
    flame.set(0);
    reveal.set(0);
    flame.set(withTiming(1, { duration: Motion.base }));
    reveal.set(withDelay(Motion.base, withTiming(1, { duration: Motion.base })));
  }, [streak, flame, reveal]);

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flame.get() }] }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ translateX: interpolate(reveal.get(), [0, 1], [-14, 0]) }],
  }));

  if (total === 0) {
    return (
      <Pressable style={styles.card} onPress={() => router.navigate('/logging')}>
        <ThemedText type="small" themeColor="textSecondary">
          No daily goals set.
        </ThemedText>
        <ThemedText type="small" themeColor="primaryLight">
          Add one
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {/* Just "N OF M", not "N OF M DONE" — the streak badge needs the room,
            and the progress bar underneath already says what this counts. */}
        <ThemedText type="label" style={styles.header} numberOfLines={1}>
          {done} of {total}
        </ThemedText>
        {streak > 0 ? (
          <View accessibilityLabel={`${streak} day streak`} style={styles.streak}>
            <Animated.View style={flameStyle}>
              <SymbolView name="flame.fill" size={12} tintColor={colors.onPrimary} />
            </Animated.View>
            {/* Clipped so the label slides out from behind the flame rather
                than fading in where it already sits. */}
            <View style={styles.streakLabelClip}>
              <Animated.View style={labelStyle}>
                <ThemedText type="caption" themeColor="onPrimary" numberOfLines={1}>
                  {streak} day streak
                </ThemedText>
              </Animated.View>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.trackFill, fillStyle]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.rows}
        showsVerticalScrollIndicator={false}>
        {defs.map((def) => {
          const isDone = doneToday.includes(def.id);
          return (
            <Pressable
              key={def.id}
              style={styles.row}
              onPress={() => {
                haptics.impact();
                onToggle(def.id);
              }}>
              <View style={[styles.checkCircle, isDone ? styles.checkCircleDone : styles.checkCircleTodo]}>
                {isDone ? <SymbolView name="checkmark" size={12} tintColor={colors.onPrimary} /> : null}
              </View>
              <ThemedText
                type="small"
                themeColor={isDone ? 'textSecondary' : 'text'}
                style={styles.flex}
                numberOfLines={2}>
                {def.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    // Top-aligned: the rows are the content, so they start at the top rather
    // than floating in the middle of a card sized by its neighbour.
    justifyContent: 'flex-start',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  header: {
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  streakLabelClip: {
    overflow: 'hidden',
  },
  track: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
  },
  scroll: {
    flex: 1,
  },
  rows: {
    gap: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: colors.primary,
  },
  checkCircleTodo: {
    borderWidth: 2,
    borderColor: colors.border,
  },
});
