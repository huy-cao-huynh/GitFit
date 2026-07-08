import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { GlowBackground } from '@/components/glow-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import type { SessionExercise } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions } = useStore();
  const session = sessions.find((s) => s.id === id);

  if (!session) {
    return (
      <View style={styles.container}>
        <GlowBackground variant="cool" />
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Workout not found</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="linkPrimary">Back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const setCount = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

  return (
    <View style={styles.container}>
      <GlowBackground variant="cool" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <SymbolView name="chevron.left" size={18} tintColor={colors.accent} />
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(session.date)}
          </ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">{session.routineName}</ThemedText>

          <View style={styles.summaryRow}>
            <SummaryStat value={`${session.durationMinutes}`} unit="min" label="Duration" />
            <SummaryStat value={`${session.calories ?? '—'}`} unit={session.calories ? 'cal' : ''} label="Calories" />
            <SummaryStat value={`${setCount}`} unit="sets" label="Volume" />
          </View>

          {session.exercises.map((exercise) => (
            <ExerciseCard key={exercise.exerciseId} exercise={exercise} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SummaryStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.summaryStat}>
      <ThemedText type="subtitle" style={styles.summaryValue}>
        {value}
        {unit ? (
          <ThemedText type="small" themeColor="textSecondary">
            {' '}
            {unit}
          </ThemedText>
        ) : null}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function ExerciseCard({ exercise }: { exercise: SessionExercise }) {
  return (
    <ThemedView type="backgroundElement" style={styles.exerciseCard}>
      <ThemedText type="smallBold">{exercise.name}</ThemedText>
      {exercise.sets.map((set, index) => (
        <View key={index} style={[styles.setRow, index > 0 && styles.setRowDivider]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.setNumber}>
            {formatSetLabel(exercise.sets, index)}
          </ThemedText>
          <ThemedText type="small">{formatSetValue(set)}</ThemedText>
          <ThemedText type="small" style={styles.setWeight}>
            {formatSetDetail(set)}
          </ThemedText>
        </View>
      ))}
    </ThemedView>
  );
}

function formatSetValue(set: { reps?: number; durationSec?: number; skipped?: boolean }) {
  if (set.skipped) return 'Skipped';
  if (set.durationSec !== undefined) return formatDuration(set.durationSec);
  return `${set.reps ?? 0} reps`;
}

function formatSetLabel(sets: { isWarmup?: boolean }[], index: number) {
  const set = sets[index];
  const matchingBefore = sets.slice(0, index + 1).filter((candidate) => candidate.isWarmup === set.isWarmup).length;
  return set.isWarmup ? `Warm-up ${matchingBefore}` : `Set ${matchingBefore}`;
}

function formatSetDetail(set: { weight?: number; durationSec?: number; skipped?: boolean }) {
  if (set.skipped) return '';
  if (set.durationSec !== undefined) return 'time';
  return (set.weight ?? 0) > 0 ? `${set.weight} lbs` : 'bodyweight';
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStat: {
    gap: Spacing.half,
  },
  summaryValue: {
    fontSize: 26,
    lineHeight: 30,
  },
  exerciseCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  setRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setNumber: {
    width: 84,
  },
  setWeight: {
    marginLeft: 'auto',
  },
});
