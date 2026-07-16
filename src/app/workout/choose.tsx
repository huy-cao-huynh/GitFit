import { router } from 'expo-router';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { scheduledRoutineTasks, todayKey } from '@/lib/store/derive';
import type { Routine } from '@/lib/store/types';
import { formatDistance } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

interface Section {
  title: string;
  data: Routine[];
}

export default function ChooseWorkoutScreen() {
  const { routines, sessions, cardioSessions, preferences } = useStore();
  const unitSystem = preferences.unitSystem;

  const plannedRoutines = scheduledRoutineTasks(routines, sessions, cardioSessions, todayKey())
    .filter((task) => !task.completed)
    .map((task) => task.routine);
  const strengthRoutines = routines.filter((routine) => routine.category === 'strength');
  const cardioRoutines = routines.filter((routine) => routine.category === 'cardio');

  const sections: Section[] = [
    ...(plannedRoutines.length > 0
      ? [{ title: plannedRoutines.length > 1 ? "Today's Planned Workouts" : "Today's Planned Workout", data: plannedRoutines }]
      : []),
    ...(strengthRoutines.length > 0 ? [{ title: 'Strength', data: strengthRoutines }] : []),
    ...(cardioRoutines.length > 0 ? [{ title: 'Cardio', data: cardioRoutines }] : []),
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ThemedText type="link" style={{ color: colors.primaryLight }}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Choose a Workout</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(routine) => routine.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.createRow}>
              <Pressable style={styles.createOption} onPress={() => router.push('/routine/new')}>
                <View style={styles.createIcon}>
                  <ThemedText style={styles.createIconText}>+</ThemedText>
                </View>
                <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                  New Strength
                </ThemedText>
              </Pressable>
              <Pressable style={styles.createOption} onPress={() => router.push('/cardio-routine/new')}>
                <View style={styles.createIcon}>
                  <ThemedText style={styles.createIconText}>+</ThemedText>
                </View>
                <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                  New Cardio
                </ThemedText>
              </Pressable>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {section.title.toUpperCase()}
            </ThemedText>
          )}
          renderItem={({ item }) => <RoutineRow routine={item} unitSystem={unitSystem} />}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              No workouts yet — create one to get started.
            </ThemedText>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function RoutineRow({ routine, unitSystem }: { routine: Routine; unitSystem: 'imperial' | 'metric' }) {
  const isCardio = routine.category === 'cardio';
  const subtitle = isCardio
    ? `${activityLabel(routine)} · ${routine.durationMinutes} min${
        routine.targetDistanceMiles ? ` · ${formatDistance(routine.targetDistanceMiles, unitSystem)}` : ''
      }`
    : `${routine.exercises.length} exercises · ${routine.durationMinutes} min`;

  const goToPlay = () =>
    router.push(
      isCardio
        ? { pathname: '/cardio/[id]', params: { id: routine.id } }
        : { pathname: '/workout/[id]', params: { id: routine.id } },
    );

  return (
    <Pressable onPress={goToPlay}>
      <ThemedView type="surface" style={styles.routineCard}>
        <View style={styles.routineIcon}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Rect x={3} y={3} width={14} height={14} rx={3} fill="none" stroke={colors.primaryLight} strokeWidth={2} />
          </Svg>
        </View>
        <View style={styles.routineText}>
          <ThemedText type="smallBold">{routine.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  headerSpacer: {
    width: 44,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  createRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  createOption: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconText: {
    color: colors.text,
    fontSize: 20,
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
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineText: {
    flex: 1,
    gap: Spacing.half,
  },
});
