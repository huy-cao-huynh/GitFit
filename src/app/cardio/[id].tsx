import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ActivityRings } from '@/components/activity-rings';
import { SummaryStat } from '@/components/summary-stat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerText } from '@/components/timer-text';
import { Colors, MaxContentWidth, Radius, RingColors, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS } from '@/lib/activity-icons';
import { haptics } from '@/lib/haptics';
import { cardioRoutinePR, currentGoalValue, estimateCardioCalories, lastCardioPerformance, todayKey } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { CardioSession } from '@/lib/store/types';
import { distanceUnitLabel, fromDisplayDistance, toDisplayDistance } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type Phase = 'idle' | 'active' | 'enteringDistance' | 'finished';

export default function CardioSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, sessions, cardioSessions, goals, goalEntries, waterEntries, steps, addCardioSession, preferences } =
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
    haptics.impact();
    setStartedAt(Date.now());
    setPhase('active');
  };

  const requestEnd = () => {
    Alert.alert('End workout early?', 'Save what you’ve done, or discard the whole session.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Save & finish', onPress: () => setPhase('enteringDistance') },
      { text: 'Discard workout', style: 'destructive', onPress: () => router.dismissTo('/dashboard') },
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
            rings={goals
              .filter((goal) => goal.metric !== 'bodyweight')
              .map((goal, index) => ({
                progress:
                  currentGoalValue(goal, sessions, updatedCardioSessions, waterEntries, goalEntries, steps) /
                  goal.target,
                color: RingColors[index % RingColors.length],
                trackColor: colors.border,
              }))}
          />

          <View style={styles.summaryRow}>
            <SummaryStat centered animatedValue={session.minutes} unit="min" label="Duration" />
            <SummaryStat centered animatedValue={session.calories ?? 0} unit="cal" label="Calories" />
            {session.distanceMiles ? (
              <SummaryStat
                centered
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
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.exerciseHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {routine.name}
            </ThemedText>
            <ThemedText type="subtitle">How far did you go?</ThemedText>
          </View>

          <ThemedView type="surface" style={styles.distanceCard}>
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
            <ThemedText type="label">
              ELAPSED
            </ThemedText>
            {/* The only DSEG7 on this screen — it's a live clock. The target
                below it is a stat, so it reads in the serif numeral face. */}
            <TimerText seconds={elapsedSec} />
            {routine.targetDistanceMiles ? (
              <ThemedText type="small" themeColor="textSecondary">
                Target:{' '}
                <ThemedText type="statInline">
                  {toDisplayDistance(routine.targetDistanceMiles, unitSystem)} {distanceUnitLabel(unitSystem)}
                </ThemedText>
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

  const lastTime = lastCardioPerformance(cardioSessions, routine.id);
  const pr = cardioRoutinePR(cardioSessions, routine.id);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <SymbolView name={ACTIVITY_ICONS[routine.activityType ?? 'other']} size={16} tintColor={colors.primaryLight} />
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
          <ThemedView type="surface" style={styles.targetCard}>
            <View style={styles.targetColumn}>
              <ThemedText type="statLarge" style={styles.targetValue}>
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
                  <ThemedText type="statLarge" style={styles.targetValue}>
                    {toDisplayDistance(routine.targetDistanceMiles, unitSystem)}
                    <ThemedText type="small" style={{ color: colors.primaryLight }}>
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

          {lastTime ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.captionRow}>
              Last time:{' '}
              <ThemedText type="statInline">
                {lastTime.minutes} min
                {lastTime.distanceMiles ? ` · ${toDisplayDistance(lastTime.distanceMiles, unitSystem)} ${distanceUnitLabel(unitSystem)}` : ''}
              </ThemedText>
            </ThemedText>
          ) : null}
          {pr ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.captionRow}>
              Best distance:{' '}
              <ThemedText type="statInline" themeColor="primary">
                {toDisplayDistance(pr.distanceMiles, unitSystem)} {distanceUnitLabel(unitSystem)}
              </ThemedText>
            </ThemedText>
          ) : null}
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
    gap: Spacing.two,
  },
  exerciseHeader: {
    gap: Spacing.half,
  },
  targetCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.four,
  },
  targetColumn: {
    flex: 1,
    alignItems: 'center',
  },
  targetValue: {
    color: colors.primaryLight,
  },
  targetDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  captionRow: {
    textAlign: 'center',
  },
  timerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  distanceCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.four,
  },
  distanceInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.onPrimary,
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
});
