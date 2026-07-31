import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Chevron } from '@/components/chevron';
import { MuscleChipRow } from '@/components/muscle-chip-row';
import { ThemedText } from '@/components/themed-text';
import { Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS } from '@/lib/activity-icons';
import { haptics } from '@/lib/haptics';
import { muscleChipsFor } from '@/lib/muscles';
import { estimateRoutineCalories, type ScheduledRoutineTask } from '@/lib/store/derive';
import type { Routine, RoutineExercise } from '@/lib/store/types';
import { formatDuration } from '@/lib/format';

const colors = Colors;

/**
 * Today's scheduled workout, expanded enough to decide from: what it hits, how
 * long it takes, what it costs, and optionally the exercise list. Its play
 * button starts *this* routine; starting something unscheduled is the
 * dashboard's separate New Workout button. Falls back to a rest-day state.
 */
export function TodayWorkoutCard({ tasks }: { tasks: ScheduledRoutineTask[] }) {
  if (tasks.length === 0) return <RestDayCard />;

  return (
    <View style={styles.stack}>
      {tasks.map((task) => (
        <WorkoutCard key={task.routine.id} task={task} />
      ))}
    </View>
  );
}

function WorkoutCard({ task }: { task: ScheduledRoutineTask }) {
  const { routine, completed } = task;
  const isCardio = routine.category === 'cardio';
  const [expanded, setExpanded] = useState(false);

  // The chevron glyph points right at 0deg, so collapsed is 90 (down) and
  // expanded is -90 (up).
  const chevronRotation = useSharedValue(90);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.get()}deg` }],
  }));

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    chevronRotation.set(withTiming(next ? -90 : 90, { duration: Motion.fast }));
  };

  const start = () => {
    haptics.impact();
    router.push(
      isCardio
        ? { pathname: '/cardio/[id]', params: { id: routine.id } }
        : { pathname: '/workout/[id]', params: { id: routine.id } },
    );
  };

  const muscles = muscleChipsFor(routine);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            {isCardio ? (
              <SymbolView name={ACTIVITY_ICONS[routine.activityType ?? 'other']} size={14} tintColor={colors.primary} />
            ) : null}
            <ThemedText type="heading" numberOfLines={2} style={styles.flex}>
              {routine.name}
            </ThemedText>
          </View>
          {!isCardio ? (
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <SymbolView name="clock" size={12} tintColor={colors.primary} />
                <ThemedText type="small" themeColor="textSecondary">
                  <ThemedText type="statInline">{routine.durationMinutes}</ThemedText> min
                </ThemedText>
              </View>
              <View style={styles.metaItem}>
                <SymbolView name="flame.fill" size={12} tintColor={colors.primary} />
                <ThemedText type="small" themeColor="textSecondary">
                  ~<ThemedText type="statInline">{estimateRoutineCalories(routine)}</ThemedText> cal
                </ThemedText>
              </View>
            </View>
          ) : null}
          {completed ? (
            <View style={styles.metaRow}>
              <SymbolView name="checkmark.circle.fill" size={13} tintColor={colors.primary} />
              <ThemedText type="small" themeColor="primary">
                Completed today
              </ThemedText>
            </View>
          ) : null}
        </View>
        {/* The scheduled workout's own start action. The full-width lime bar on
            the dashboard is for starting something unscheduled. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name}`}
          hitSlop={8}
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
          onPress={start}>
          <Svg width={15} height={17} viewBox="0 0 14 16">
            <Path d="M0 0l14 8-14 8z" fill={colors.onPrimary} />
          </Svg>
        </Pressable>
      </View>

      <MuscleChipRow muscles={muscles} />

      {isCardio ? (
        <ThemedText type="small" themeColor="textSecondary">
          {activityLabel(routine)}
        </ThemedText>
      ) : (
        <>
          <Pressable style={styles.summaryRow} onPress={toggle} hitSlop={6}>
            <ThemedText type="small" style={styles.flex}>
              {routine.exercises.length} exercises,{' '}
              {routine.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets
            </ThemedText>
            <Animated.View style={chevronStyle}>
              <Chevron color={colors.textSecondary} />
            </Animated.View>
          </Pressable>
          {expanded ? (
            <View style={styles.exerciseList}>
              {routine.exercises.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                    {exercise.name}
                  </ThemedText>
                  <ThemedText type="statInline" themeColor="textSecondary">
                    {describeSetsBrief(exercise)}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}

    </View>
  );
}

function RestDayCard() {
  return (
    <View style={[styles.card, styles.restCard]}>
      <View style={styles.restIcon}>
        <SymbolView name="moon.zzz.fill" size={26} tintColor={colors.primary} />
      </View>
      <ThemedText type="heading">Rest day</ThemedText>
      {/* No escape hatch needed here — the New Workout button below the card
          covers starting something unscheduled. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.restCopy}>
        No workouts scheduled today.
      </ThemedText>
    </View>
  );
}

/** Bare "sets × reps" numbers, e.g. "3 × 8" — no weight, no unit words. The card is a glance-preview, not the routine editor. */
function describeSetsBrief(exercise: RoutineExercise): string {
  const working = exercise.sets.filter((set) => !set.isWarmup);
  const warmupCount = exercise.sets.length - working.length;
  const warmupLabel = warmupCount > 0 ? `${warmupCount} warm-up + ` : '';

  if (working.length === 0) {
    return warmupCount > 0 ? `${warmupCount} warm-up set${warmupCount === 1 ? '' : 's'}` : 'No sets yet';
  }

  if ((exercise.kind ?? 'reps') === 'time') {
    const durations = working.map((set) => set.durationSec ?? 0);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const durationLabel = min === max ? formatDuration(min) : `${formatDuration(min)}–${formatDuration(max)}`;
    return `${warmupLabel}${working.length} · ${durationLabel}`;
  }

  const reps = working.map((set) => set.reps ?? 0);
  const minReps = Math.min(...reps);
  const maxReps = Math.max(...reps);
  const repsLabel = minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`;
  return `${warmupLabel}${working.length} × ${repsLabel}`;
}

function activityLabel(routine: Routine): string {
  if (!routine.activityType) return 'Cardio';
  return routine.activityType.charAt(0).toUpperCase() + routine.activityType.slice(1);
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  playButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  exerciseList: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  restCard: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  restIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  restCopy: {
    textAlign: 'center',
  },
});
