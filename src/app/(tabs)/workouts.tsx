import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CardioRow } from '@/components/cardio-row';
import { Chevron } from '@/components/chevron';
import { MuscleCoverageBar } from '@/components/muscle-coverage-bar';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS } from '@/lib/activity-icons';
import { muscleCoverageThisWeek, recentWorkoutHistory, routineScheduleLabel } from '@/lib/store/derive';
import type { Routine, Session, WorkoutCategory } from '@/lib/store/types';
import { useResetScrollOnFocus } from '@/lib/use-reset-scroll-on-focus';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

const CATEGORY_LABELS: Record<WorkoutCategory, string> = { strength: 'Strength', cardio: 'Cardio' };
const HISTORY_DAYS = 30;

export default function WorkoutsScreen() {
  const { routines, sessions, cardioSessions, preferences } = useStore();
  const [category, setCategory] = useState<WorkoutCategory>('strength');
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const filtered = routines.filter((routine) => routine.category === category);
  const listRef = useResetScrollOnFocus<FlatList<Routine>>();
  const muscleHit = muscleCoverageThisWeek(sessions);
  const history = recentWorkoutHistory(sessions, cardioSessions, HISTORY_DAYS);

  const segmentWidth = segmentedWidth > 0 ? (segmentedWidth - Spacing.half * 2) / 2 : 0;
  const position = useSharedValue(category === 'strength' ? 0 : 1);
  useEffect(() => {
    position.value = withTiming(category === 'strength' ? 0 : 1, { duration: Motion.base });
  }, [category, position]);
  const segmentPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * segmentWidth }],
  }));

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Workouts</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
          Build your routines and track your training
        </ThemedText>

        <View style={styles.segmented} onLayout={(e) => setSegmentedWidth(e.nativeEvent.layout.width)}>
          {segmentWidth > 0 && (
            <Animated.View style={[styles.segmentPill, { width: segmentWidth }, segmentPillStyle]} />
          )}
          {(['strength', 'cardio'] as WorkoutCategory[]).map((option) => {
            const active = category === option;
            return (
              <Pressable key={option} style={styles.segment} onPress={() => setCategory(option)}>
                <ThemedText type="smallBold" style={active ? { color: colors.onPrimary } : undefined}>
                  {CATEGORY_LABELS[option]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {category === 'strength' && (
          <View style={styles.coverageBar}>
            <MuscleCoverageBar hit={muscleHit} />
          </View>
        )}

        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(routine) => routine.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Pressable
              style={styles.createRow}
              onPress={() => router.push(category === 'strength' ? '/routine/new' : '/cardio-routine/new')}>
              <View style={styles.createIcon}>
                <SymbolView name="plus" size={16} tintColor={colors.onPrimary} />
              </View>
              <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                New {CATEGORY_LABELS[category]} Workout
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item }) => <RoutineRow routine={item} />}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              Create a {CATEGORY_LABELS[category].toLowerCase()} workout to get started.
            </ThemedText>
          }
          ListFooterComponent={
            history.length > 0 ? (
              <View style={styles.historySection}>
                <ThemedText type="label" style={styles.historyLabel}>
                  Last {HISTORY_DAYS} days
                </ThemedText>
                <View style={styles.historyList}>
                  {history.map((entry) =>
                    entry.type === 'cardio' ? (
                      <CardioRow key={entry.session.id} session={entry.session} unitSystem={preferences.unitSystem} />
                    ) : (
                      <HistoryRow key={entry.session.id} session={entry.session} />
                    ),
                  )}
                </View>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
}

function RoutineRow({ routine }: { routine: Routine }) {
  const isCardio = routine.category === 'cardio';
  const subtitle = isCardio ? activityLabel(routine) : `${routine.exercises.length} exercises · ${routine.durationMinutes} min`;
  const schedule = routineScheduleLabel(routine);

  const goToEdit = () =>
    router.push(
      isCardio ? { pathname: '/cardio-routine/[id]', params: { id: routine.id } } : { pathname: '/routine/[id]', params: { id: routine.id } },
    );
  const goToPlay = () =>
    router.push(
      isCardio ? { pathname: '/cardio/[id]', params: { id: routine.id } } : { pathname: '/workout/[id]', params: { id: routine.id } },
    );

  return (
    <Pressable onPress={goToEdit}>
      <ThemedView type="surface" style={styles.routineCard}>
        <View style={styles.routineIcon}>
          <SymbolView
            name={isCardio ? ACTIVITY_ICONS[routine.activityType ?? 'other'] : 'dumbbell'}
            size={22}
            tintColor={colors.primaryLight}
          />
        </View>
        <View style={styles.routineText}>
          <ThemedText type="smallBold">{routine.name}</ThemedText>
          {/* Exercise count / duration / schedule are the card's whole payload —
              they carry information, so they aren't dimmed. */}
          <ThemedText type="small">{subtitle}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {schedule}
          </ThemedText>
        </View>
        <Pressable hitSlop={8} style={styles.playButton} onPress={goToPlay}>
          <Svg width={12} height={14} viewBox="0 0 14 16">
            <Path d="M0 0l14 8-14 8z" fill={colors.onPrimary} />
          </Svg>
        </Pressable>
        <Chevron color={colors.textSecondary} />
      </ThemedView>
    </Pressable>
  );
}

function HistoryRow({ session }: { session: Session }) {
  const setCount = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

  return (
    <Pressable onPress={() => router.push({ pathname: '/history/[id]', params: { id: session.id } })}>
      <ThemedView type="surface" style={styles.historyRow}>
        <View style={styles.historyThumb}>
          <SymbolView name="dumbbell" size={20} tintColor={colors.textSecondary} />
        </View>
        <View style={styles.historyBody}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {session.routineName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatHistoryDate(session.date)}
          </ThemedText>
          <View style={styles.historyMetaRow}>
            <ThemedText type="statInline" themeColor="textSecondary">
              {session.durationMinutes} min
            </ThemedText>
            <ThemedText type="statInline" themeColor="textSecondary">
              {setCount} sets
            </ThemedText>
          </View>
        </View>
        <Chevron color={colors.textSecondary} />
      </ThemedView>
    </Pressable>
  );
}

function formatHistoryDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function activityLabel(routine: Routine): string {
  if (!routine.activityType) return 'Cardio';
  return routine.activityType.charAt(0).toUpperCase() + routine.activityType.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
  },
  title: {
    marginBottom: Spacing.three,
  },
  coverageBar: {
    marginBottom: Spacing.three,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.half,
    marginBottom: Spacing.three,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
  },
  segmentPill: {
    position: 'absolute',
    top: Spacing.half,
    bottom: Spacing.half,
    left: Spacing.half,
    borderRadius: Radius.sm,
    backgroundColor: colors.primary,
  },
  list: {
    gap: Spacing.three,
  },
  routineCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  routineIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineText: {
    flex: 1,
    gap: Spacing.half,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  createRow: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySection: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  historyLabel: {
    textTransform: 'uppercase',
  },
  historyList: {
    gap: Spacing.two,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.two,
    paddingRight: Spacing.three,
  },
  historyThumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBody: {
    flex: 1,
    gap: Spacing.half,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
});
