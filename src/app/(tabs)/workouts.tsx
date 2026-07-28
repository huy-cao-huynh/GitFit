import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Chevron } from '@/components/chevron';
import { GradientFill } from '@/components/gradient-fill';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Gradients, Motion, Radius, Spacing } from '@/constants/theme';
import { routineScheduleLabel } from '@/lib/store/derive';
import type { Routine, WorkoutCategory } from '@/lib/store/types';
import { formatDistance } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

const CATEGORY_LABELS: Record<WorkoutCategory, string> = { strength: 'Strength', cardio: 'Cardio' };

export default function WorkoutsScreen() {
  const { routines, preferences } = useStore();
  const [category, setCategory] = useState<WorkoutCategory>('strength');
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const filtered = routines.filter((routine) => routine.category === category);

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
        <ThemedText type="subtitle" style={styles.title}>
          Workouts
        </ThemedText>

        <View style={styles.segmented} onLayout={(e) => setSegmentedWidth(e.nativeEvent.layout.width)}>
          {segmentWidth > 0 && (
            <Animated.View style={[styles.segmentPill, { width: segmentWidth }, segmentPillStyle]} />
          )}
          {(['strength', 'cardio'] as WorkoutCategory[]).map((option) => {
            const active = category === option;
            return (
              <Pressable key={option} style={styles.segment} onPress={() => setCategory(option)}>
                <ThemedText type="smallBold" style={active ? { color: colors.text } : undefined}>
                  {CATEGORY_LABELS[option]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(routine) => routine.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable
              style={styles.createRow}
              onPress={() => router.push(category === 'strength' ? '/routine/new' : '/cardio-routine/new')}>
              <View style={styles.createIcon}>
                <SymbolView name="plus" size={16} tintColor={colors.text} />
              </View>
              <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                New {CATEGORY_LABELS[category]} Workout
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item }) => <RoutineRow routine={item} unitSystem={preferences.unitSystem} />}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              Create a {CATEGORY_LABELS[category].toLowerCase()} workout to get started.
            </ThemedText>
          }
        />
      </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
}

function RoutineRow({ routine, unitSystem }: { routine: Routine; unitSystem: 'imperial' | 'metric' }) {
  const isCardio = routine.category === 'cardio';
  const subtitle = isCardio
    ? `${activityLabel(routine)} · ${routine.durationMinutes} min${
        routine.targetDistanceMiles ? ` · ${formatDistance(routine.targetDistanceMiles, unitSystem)}` : ''
      }`
    : `${routine.exercises.length} exercises · ${routine.durationMinutes} min`;
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
          <GradientFill stops={Gradients.cardAccent} angle={135} />
          <SymbolView
            name={isCardio ? 'figure.run' : 'dumbbell'}
            size={22}
            tintColor={colors.primaryLight}
          />
        </View>
        <View style={styles.routineText}>
          <ThemedText type="smallBold">{routine.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {schedule}
          </ThemedText>
        </View>
        <Pressable hitSlop={8} style={styles.playButton} onPress={goToPlay}>
          <GradientFill stops={Gradients.cta} />
          <Svg width={12} height={14} viewBox="0 0 14 16">
            <Path d="M0 0l14 8-14 8z" fill={colors.text} />
          </Svg>
        </Pressable>
        <Chevron color={colors.textMuted} />
      </ThemedView>
    </Pressable>
  );
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
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  routineIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  routineText: {
    flex: 1,
    gap: Spacing.half,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
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
});
