import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRings } from '@/components/activity-rings';
import { GlowBackground } from '@/components/glow-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, RingColors, Spacing } from '@/constants/theme';
import { currentGoalValue, estimateCardioCalories, todayKey } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { CardioSession } from '@/lib/store/types';
import { distanceUnitLabel, fromDisplayDistance, toDisplayDistance } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type Phase = 'idle' | 'active' | 'enteringDistance' | 'finished';

export default function CardioSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, sessions, cardioSessions, goals, waterEntries, addCardioSession, preferences } =
    useStore();
  const unitSystem = preferences.unitSystem;
  const routine = routines.find((r) => r.id === id && r.category === 'cardio');

  const [phase, setPhase] = useState<Phase>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceDisplay, setDistanceDisplay] = useState(
    routine?.targetDistanceMiles ? String(toDisplayDistance(routine.targetDistanceMiles, unitSystem)) : '',
  );
  const [finishedSession, setFinishedSession] = useState<CardioSession | null>(null);

  useEffect(() => {
    if (startedAt === null || phase !== 'active') return;
    const interval = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [phase, startedAt]);

  if (!routine) {
    return (
      <View style={styles.container}>
        <GlowBackground variant="session" />
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Workout not found</ThemedText>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <ThemedText style={styles.primaryButtonText}>Back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const start = () => {
    setStartedAt(Date.now());
    setPhase('active');
  };

  const requestEnd = () => {
    Alert.alert('End workout?', 'Your time will be saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End workout', style: 'destructive', onPress: () => setPhase('enteringDistance') },
    ]);
  };

  const saveSession = () => {
    const minutes = Math.max(1, Math.round(elapsedSec / 60));
    const distanceMiles = distanceDisplay.trim() ? fromDisplayDistance(Number(distanceDisplay), unitSystem) : undefined;
    const session: CardioSession = {
      id: makeId(),
      routineId: routine.id,
      name: routine.name,
      activityType: routine.activityType ?? 'other',
      date: todayKey(),
      minutes,
      distanceMiles: distanceMiles && Number.isFinite(distanceMiles) && distanceMiles > 0 ? distanceMiles : undefined,
      calories: estimateCardioCalories(routine.activityType ?? 'other', minutes),
    };
    addCardioSession(session);
    setFinishedSession(session);
    setPhase('finished');
  };

  if (phase === 'finished') {
    const session = finishedSession!;
    const updatedCardioSessions = [session, ...cardioSessions];

    return (
      <View style={styles.container}>
        <GlowBackground variant="session" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.finishedHeader}>
            <ThemedText type="title">Workout finished!</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Nice work. Your weekly rings have been updated.
            </ThemedText>
          </View>

          <ActivityRings
            animated
            size={220}
            strokeWidth={15}
            gap={6}
            rings={goals.map((goal, index) => ({
              progress: currentGoalValue(goal, sessions, updatedCardioSessions, waterEntries) / goal.target,
              color: RingColors[index % RingColors.length],
              trackColor: colors.backgroundSelected,
            }))}
          />

          <View style={styles.summaryRow}>
            <SummaryStat value={`${session.minutes}`} unit="min" label="Duration" />
            <SummaryStat value={`${session.calories ?? 0}`} unit="cal" label="Calories" />
            {session.distanceMiles ? (
              <SummaryStat
                value={`${toDisplayDistance(session.distanceMiles, unitSystem)}`}
                unit={distanceUnitLabel(unitSystem)}
                label="Distance"
              />
            ) : null}
          </View>

          <Pressable style={styles.primaryButton} onPress={() => router.dismissTo('/dashboard')}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Return to Home
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'enteringDistance') {
    return (
      <View style={styles.container}>
        <GlowBackground variant="session" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.exerciseHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {routine.name}
            </ThemedText>
            <ThemedText type="subtitle">How far did you go?</ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.distanceCard}>
            <TextInput
              style={styles.distanceInput}
              placeholder={`Distance (${distanceUnitLabel(unitSystem)}, optional)`}
              placeholderTextColor={colors.textSecondary}
              value={distanceDisplay}
              onChangeText={setDistanceDisplay}
              keyboardType="decimal-pad"
            />
          </ThemedView>

          <Pressable style={styles.primaryButton} onPress={saveSession}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Save Workout
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'active') {
    return (
      <View style={styles.container}>
        <GlowBackground variant="session" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {routine.name}
            </ThemedText>
            <Pressable onPress={requestEnd} hitSlop={12}>
              <ThemedText type="small" themeColor="textSecondary">
                End
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.timerArea}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ELAPSED
            </ThemedText>
            <ThemedText type="title" style={styles.timerValue}>
              {formatDuration(elapsedSec)}
            </ThemedText>
            {routine.targetDistanceMiles ? (
              <ThemedText type="small" themeColor="textSecondary">
                Target: {toDisplayDistance(routine.targetDistanceMiles, unitSystem)} {distanceUnitLabel(unitSystem)}
              </ThemedText>
            ) : null}
          </View>

          <Pressable style={styles.primaryButton} onPress={requestEnd}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              End Workout
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlowBackground variant="session" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {routine.name}
          </ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="small" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.overviewContent}>
          <ThemedView type="backgroundElement" style={styles.targetCard}>
            <View style={styles.targetColumn}>
              <ThemedText type="title" style={styles.targetValue}>
                {routine.durationMinutes}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                target minutes
              </ThemedText>
            </View>
            {routine.targetDistanceMiles ? (
              <>
                <View style={styles.targetDivider} />
                <View style={styles.targetColumn}>
                  <ThemedText type="title" style={styles.targetValue}>
                    {toDisplayDistance(routine.targetDistanceMiles, unitSystem)}
                    <ThemedText type="small" style={{ color: colors.accentLight }}>
                      {' '}
                      {distanceUnitLabel(unitSystem)}
                    </ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    target distance
                  </ThemedText>
                </View>
              </>
            ) : null}
          </ThemedView>
        </ScrollView>

        <Pressable style={styles.primaryButton} onPress={start}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            Start
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function SummaryStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.summaryStat}>
      <ThemedText type="subtitle" style={styles.summaryValue}>
        {value}
        <ThemedText type="small" themeColor="textSecondary">
          {' '}
          {unit}
        </ThemedText>
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function formatDuration(totalSeconds: number): string {
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
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  overviewContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  exerciseHeader: {
    gap: Spacing.half,
  },
  targetCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.four,
  },
  targetColumn: {
    flex: 1,
    alignItems: 'center',
  },
  targetValue: {
    fontSize: 36,
    lineHeight: 40,
    color: colors.accentLight,
  },
  targetDivider: {
    width: 1,
    backgroundColor: colors.backgroundSelected,
  },
  timerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  timerValue: {
    fontSize: 56,
    lineHeight: 62,
  },
  distanceCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
  },
  distanceInput: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.backgroundSelected,
  },
  primaryButton: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 17,
  },
  finishedHeader: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    gap: Spacing.half,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 26,
    lineHeight: 30,
  },
});
