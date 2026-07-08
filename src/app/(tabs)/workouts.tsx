import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { Chevron } from '@/components/chevron';
import { GlowBackground } from '@/components/glow-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { routineScheduleLabel } from '@/lib/store/derive';
import type { Routine, WorkoutCategory } from '@/lib/store/types';
import { formatDistance } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

const CATEGORY_LABELS: Record<WorkoutCategory, string> = { strength: 'Strength', cardio: 'Cardio' };

export default function WorkoutsScreen() {
  const { routines, preferences } = useStore();
  const [category, setCategory] = useState<WorkoutCategory>('strength');
  const filtered = routines.filter((routine) => routine.category === category);

  return (
    <TabFadeView style={styles.container}>
      <GlowBackground variant="cool" />
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Workouts
        </ThemedText>

        <View style={styles.segmented}>
          {(['strength', 'cardio'] as WorkoutCategory[]).map((option) => {
            const active = category === option;
            return (
              <Pressable
                key={option}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setCategory(option)}>
                <ThemedText type="smallBold" style={active ? { color: colors.background } : undefined}>
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
                <SymbolView name="plus" size={16} tintColor={colors.background} />
              </View>
              <ThemedText type="smallBold" style={{ color: colors.accent }}>
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
      <ThemedView type="backgroundElement" style={styles.routineCard}>
        <View style={[styles.routineIcon, { backgroundColor: routine.tileColor }]}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Rect x={3} y={3} width={14} height={14} rx={3} fill="none" stroke={colors.accent} strokeWidth={2} />
          </Svg>
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
          <Svg width={12} height={14} viewBox="0 0 14 16">
            <Path d="M0 0l14 8-14 8z" fill={colors.background} />
          </Svg>
        </Pressable>
        <Chevron color={colors.textSecondary} />
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
    borderRadius: Spacing.four,
    backgroundColor: colors.backgroundSelected,
    padding: Spacing.half,
    marginBottom: Spacing.three,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  list: {
    gap: Spacing.two,
  },
  routineCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  routineIcon: {
    width: 44,
    height: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineText: {
    flex: 1,
    gap: Spacing.half,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  createRow: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    borderRadius: Spacing.four,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
