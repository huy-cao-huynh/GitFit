import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { CountdownTimer } from '@/components/countdown-timer';
import { ExerciseSetEditor } from '@/components/exercise-set-editor';
import { SortableList } from '@/components/sortable-list';
import { SummaryStat } from '@/components/summary-stat';
import { ThemedText } from '@/components/themed-text';
import { TimerText } from '@/components/timer-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatDuration } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { muscleGroupsFor } from '@/lib/muscles';
import { describeExerciseSets, exercisePR, lastExercisePerformance, STRENGTH_CALORIES_PER_MINUTE, todayKey } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { ExerciseKind, RoutineExercise, RoutineSet, Session, SessionExercise, SetLog, UnitSystem } from '@/lib/store/types';
import { clampToStep, formatStepperValue } from '@/lib/stepper-math';
import { formatWeight, fromDisplayWeight, toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { clearWorkoutSession, loadWorkoutSession, saveWorkoutSession, type WorkoutSessionSnapshot } from '@/lib/workout-session-storage';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const REST_SECONDS = 30;
const QUEUE_ROW_HEIGHT = 56;

type SessionPhase = 'exerciseReady' | 'setPending' | 'setActive' | 'setLogging' | 'resting' | 'finished';
type WorkoutExercise = RoutineExercise & { restSec: number };

interface ExerciseEditDraft {
  id: string;
  name: string;
  kind: ExerciseKind;
  sets: RoutineSet[];
  restSec: number;
}

interface SessionPR {
  name: string;
  weight: number;
  reps?: number;
  isFirst: boolean;
}

/** New all-time bests set this session, compared against `priorSessions` (must not yet include this session). */
function computeSessionPRs(finalLogged: SessionExercise[], priorSessions: Session[]): SessionPR[] {
  const results: SessionPR[] = [];
  for (const item of finalLogged) {
    const bestSet = item.sets.reduce<SetLog | null>((best, set) => {
      if (set.isWarmup || set.skipped || set.kind === 'time' || !set.weight) return best;
      if (!best || set.weight > (best.weight ?? 0)) return set;
      return best;
    }, null);
    if (!bestSet?.weight) continue;
    const priorPR = exercisePR(priorSessions, item.name);
    if (!priorPR || bestSet.weight > priorPR.weight) {
      results.push({ name: item.name, weight: bestSet.weight, reps: bestSet.reps, isFirst: !priorPR });
    }
  }
  return results;
}

/** Ascending reference objects (canonical lbs) for the post-workout "you lifted about as much as…" note. */
const WEIGHT_COMPARISONS = [
  { lbs: 60, emoji: '🐕', label: 'a Golden Retriever', plural: 'Golden Retrievers' },
  { lbs: 180, emoji: '🧍', label: 'an adult human', plural: 'adult humans' },
  { lbs: 400, emoji: '🎹', label: 'a grand piano', plural: 'grand pianos' },
  { lbs: 700, emoji: '🏍️', label: 'a motorcycle', plural: 'motorcycles' },
  { lbs: 2000, emoji: '🚗', label: 'a small car', plural: 'small cars' },
  { lbs: 5000, emoji: '🛻', label: 'a pickup truck', plural: 'pickup trucks' },
  { lbs: 12000, emoji: '🦖', label: 'a T. rex', plural: 'T. rexes' },
  { lbs: 24000, emoji: '🚌', label: 'a school bus', plural: 'school buses' },
] as const;

function describeWeightComparison(totalLbs: number): { emoji: string; label: string } | null {
  if (totalLbs < WEIGHT_COMPARISONS[0].lbs) return null;
  const match = [...WEIGHT_COMPARISONS].reverse().find((entry) => totalLbs >= entry.lbs) ?? WEIGHT_COMPARISONS[0];
  const multiple = Math.floor(totalLbs / match.lbs);
  return {
    emoji: match.emoji,
    label: multiple > 1 ? `${multiple} ${match.plural}` : match.label,
  };
}

function toWorkoutExercise(exercise: RoutineExercise): WorkoutExercise {
  return {
    ...exercise,
    kind: exercise.kind ?? 'reps',
    restSec: exercise.restSec ?? REST_SECONDS,
  };
}

function totalPlannedSets(exercise: WorkoutExercise): number {
  return exercise.sets.length;
}

/** "Warm-up 2 of 3" / "Set 2 of 3" — counts position among same-flag sets so far, independent of ordering. */
function formatCurrentSetLabel(sets: RoutineSet[], setIndex: number): string {
  const current = sets[setIndex];
  if (!current) return '';
  const sameKind = sets.filter((set) => set.isWarmup === current.isWarmup);
  const positionAmongKind = sets.slice(0, setIndex + 1).filter((set) => set.isWarmup === current.isWarmup).length;
  return current.isWarmup ? `Warm-up ${positionAmongKind} of ${sameKind.length}` : `Set ${positionAmongKind} of ${sameKind.length}`;
}

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, sessions, addSession, preferences } = useStore();
  const unitSystem = preferences.unitSystem;
  const routine = routines.find((r) => r.id === id);

  const [order, setOrder] = useState<WorkoutExercise[]>(routine?.exercises.map(toWorkoutExercise) ?? []);
  const [phase, setPhase] = useState<SessionPhase>('exerciseReady');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [logged, setLogged] = useState<SessionExercise[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [reps, setReps] = useState(routine?.exercises[0]?.sets[0]?.reps ?? 10);
  const [weight, setWeight] = useState(routine?.exercises[0]?.sets[0]?.weight ?? 0);
  const [durationSec, setDurationSec] = useState(routine?.exercises[0]?.sets[0]?.durationSec ?? 45);
  const [editingDraft, setEditingDraft] = useState<ExerciseEditDraft | null>(null);
  const [finishedSession, setFinishedSession] = useState<Session | null>(null);
  const [sessionPRs, setSessionPRs] = useState<SessionPR[]>([]);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentSetStartedAt, setCurrentSetStartedAt] = useState<number | null>(null);
  const [currentSetElapsedSec, setCurrentSetElapsedSec] = useState(0);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);

  useEffect(() => {
    if (startedAt === null || phase === 'finished') return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startedAt]);

  useEffect(() => {
    const currentKind = order[exerciseIndex]?.kind ?? 'reps';
    if (currentSetStartedAt === null || !(phase === 'setActive' && currentKind === 'reps')) return;
    const interval = setInterval(() => {
      setCurrentSetElapsedSec(Math.floor((Date.now() - currentSetStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, exerciseIndex, order, currentSetStartedAt]);

  useEffect(() => {
    let cancelled = false;
    const routineId = routine?.id;
    (async () => {
      const snapshot = routineId ? await loadWorkoutSession(routineId) : null;
      if (cancelled) return;
      if (snapshot) {
        setOrder(snapshot.order);
        setPhase(snapshot.phase);
        setExerciseIndex(snapshot.exerciseIndex);
        setSetIndex(snapshot.setIndex);
        setLogged(snapshot.logged);
        setStartedAt(snapshot.startedAt);
        setReps(snapshot.reps);
        setWeight(snapshot.weight);
        setDurationSec(snapshot.durationSec);
        setCurrentSetStartedAt(snapshot.setStartedAt);
        setPhaseEndsAt(snapshot.phaseEndsAt);
        if (snapshot.phaseEndsAt !== null) {
          setTimerSeconds(Math.max(0, Math.ceil((snapshot.phaseEndsAt - Date.now()) / 1000)));
        }
      }
      setHasCheckedResume(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [routine?.id]);

  useEffect(() => {
    if (!routine || startedAt === null || phase === 'finished' || !hasCheckedResume) return;
    const snapshot: WorkoutSessionSnapshot = {
      savedAt: Date.now(),
      order,
      phase,
      exerciseIndex,
      setIndex,
      logged,
      startedAt,
      reps,
      weight,
      durationSec,
      setStartedAt: currentSetStartedAt,
      phaseEndsAt,
    };
    saveWorkoutSession(routine.id, snapshot);
  }, [
    routine,
    hasCheckedResume,
    order,
    phase,
    exerciseIndex,
    setIndex,
    logged,
    startedAt,
    reps,
    weight,
    durationSec,
    currentSetStartedAt,
    phaseEndsAt,
  ]);

  const exercise = order[exerciseIndex];

  if (!routine || !exercise) {
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

  if (!hasCheckedResume) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} />
      </View>
    );
  }

  const exerciseKind = exercise.kind ?? 'reps';
  const totalSets = order.reduce((sum, item) => sum + totalPlannedSets(item), 0);
  const completedSets = logged.reduce((sum, item) => sum + item.sets.filter((set) => !set.skipped).length, 0);
  const attemptedSets = logged.reduce((sum, item) => sum + item.sets.length, 0);
  const overallProgress = totalSets > 0 ? attemptedSets / totalSets : 0;
  const warmupSetCount = exercise.sets.filter((set) => set.isWarmup).length;
  const activeSet = exercise.sets[setIndex] as RoutineSet | undefined;
  const isWarmupSet = activeSet?.isWarmup ?? false;
  const plannedSetCount = totalPlannedSets(exercise);
  const isLastSet = setIndex + 1 >= plannedSetCount;
  const isLastExercise = exerciseIndex + 1 >= order.length;
  const workoutCalories = Math.max(1, Math.round(elapsedSec / 60)) * STRENGTH_CALORIES_PER_MINUTE;

  const lastPerformance = lastExercisePerformance(sessions, exercise.name);
  const personalRecord = exercisePR(sessions, exercise.name);
  const muscleGroups = muscleGroupsFor(exercise.name);
  // Working-set number (0-based, warm-ups excluded) for matching against the
  // corresponding set of the previous session.
  const workingSetNumber = Math.max(0, setIndex - warmupSetCount);
  const lastMatchingSet = lastPerformance
    ? lastPerformance.sets[Math.min(workingSetNumber, lastPerformance.sets.length - 1)]
    : null;

  const weightQuickValues = Array.from(
    new Set(
      [activeSet?.weight, lastMatchingSet?.weight, personalRecord?.weight]
        .filter((value): value is number => !!value)
        .map((value) => toDisplayWeight(value, unitSystem)),
    ),
  )
    .sort((a, b) => a - b)
    .slice(0, 3);

  const startExercise = () => {
    setStartedAt((value) => value ?? Date.now());
    const target = exercise.sets[0];
    if (target) {
      setReps(target.reps ?? 0);
      setWeight(target.weight ?? 0);
      setDurationSec(target.durationSec ?? 0);
    }
    setPhase('setPending');
  };

  const appendLog = (set: SetLog): SessionExercise[] => {
    const existing = logged.find((item) => item.exerciseId === exercise.id);
    if (existing) {
      return logged.map((item) =>
        item.exerciseId === exercise.id ? { ...item, sets: [...item.sets, set] } : item,
      );
    }
    return [...logged, { exerciseId: exercise.id, name: exercise.name, sets: [set] }];
  };

  const completeSet = (override?: SetLog) => {
    const warmupFlag = isWarmupSet || undefined;
    const setLog =
      override ??
      (exerciseKind === 'time'
        ? { kind: 'time', durationSec, isWarmup: warmupFlag }
        : { kind: 'reps', reps, weight, isWarmup: warmupFlag });
    const next = appendLog(
      override && override.isWarmup === undefined ? { ...setLog, isWarmup: warmupFlag } : setLog,
    );
    setLogged(next);
    setCurrentSetStartedAt(null);

    if (isLastSet && isLastExercise) {
      finishWorkout(next);
    } else {
      const restSec = exercise.restSec;
      setPhaseEndsAt(() => Date.now() + restSec * 1000);
      setTimerSeconds(restSec);
      setPhase('resting');
    }
  };

  const startSet = () => {
    if (exerciseKind === 'time') {
      const targetDurationSec = durationSec;
      setPhaseEndsAt(() => Date.now() + targetDurationSec * 1000);
      setTimerSeconds(targetDurationSec);
    } else {
      setCurrentSetStartedAt(() => Date.now());
    }
    setPhase('setActive');
  };

  const skipSet = () => {
    const warmupFlag = isWarmupSet || undefined;
    completeSet(
      exerciseKind === 'time'
        ? { kind: 'time', durationSec: 0, isWarmup: warmupFlag, skipped: true }
        : { kind: 'reps', isWarmup: warmupFlag, skipped: true },
    );
  };

  const advanceToNextExercise = (currentLogged: SessionExercise[]) => {
    const upcoming = order[exerciseIndex + 1];
    if (!upcoming) {
      finishWorkout(currentLogged);
      return;
    }
    setExerciseIndex((index) => index + 1);
    setSetIndex(0);
    const target = upcoming.sets[0];
    if (target) {
      setReps(target.reps ?? 0);
      setWeight(target.weight ?? 0);
      setDurationSec(target.durationSec ?? 0);
    }
    setPhase('exerciseReady');
  };

  const advanceAfterRest = () => {
    if (!isLastSet) {
      const nextSetIndex = setIndex + 1;
      const target = exercise.sets[nextSetIndex];
      setSetIndex(nextSetIndex);
      if (target) {
        setReps(target.reps ?? 0);
        setWeight(target.weight ?? 0);
        setDurationSec(target.durationSec ?? 0);
      }
      setPhase('setPending');
      return;
    }
    advanceToNextExercise(logged);
  };

  /** Marks every remaining set of the current exercise as skipped and moves on. */
  const skipExercise = () => {
    const remainingSets: SetLog[] = exercise.sets.slice(setIndex).map((set) => ({
      kind: exerciseKind,
      skipped: true,
      isWarmup: set.isWarmup || undefined,
    }));
    const existing = logged.find((item) => item.exerciseId === exercise.id);
    const next = existing
      ? logged.map((item) =>
          item.exerciseId === exercise.id ? { ...item, sets: [...item.sets, ...remainingSets] } : item,
        )
      : [...logged, { exerciseId: exercise.id, name: exercise.name, sets: remainingSets }];
    setLogged(next);
    advanceToNextExercise(next);
  };

  const confirmSkipExercise = () => {
    Alert.alert(`Skip ${exercise.name}?`, 'Its remaining sets will be marked as skipped.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Skip exercise', style: 'destructive', onPress: skipExercise },
    ]);
  };

  const buildSession = (finalLogged: SessionExercise[]): Session => {
    const durationMinutes = Math.max(1, Math.round(elapsedSec / 60));
    return {
      id: makeId(),
      routineId: routine.id,
      routineName: routine.name,
      date: todayKey(),
      durationMinutes,
      calories: durationMinutes * STRENGTH_CALORIES_PER_MINUTE,
      exercises: finalLogged.filter((item) => item.sets.some((set) => !set.skipped)),
    };
  };

  const finishWorkout = (finalLogged: SessionExercise[]) => {
    const session = buildSession(finalLogged);
    setSessionPRs(computeSessionPRs(finalLogged, sessions));
    if (session.exercises.length > 0) addSession(session);
    clearWorkoutSession(routine.id);
    setFinishedSession(session);
    setPhase('finished');
  };

  const discardWorkout = () => {
    clearWorkoutSession(routine.id);
    router.dismissTo('/dashboard');
  };

  const confirmEnd = () => {
    const hasWork = logged.some((item) => item.sets.some((set) => !set.skipped));
    if (!hasWork) {
      Alert.alert('End workout?', 'Nothing has been logged yet, so the session will be discarded.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discardWorkout },
      ]);
      return;
    }
    Alert.alert('End workout early?', 'Save what you’ve done, or discard the whole session.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Save & finish', onPress: () => finishWorkout(logged) },
      { text: 'Discard workout', style: 'destructive', onPress: discardWorkout },
    ]);
  };

  const reorderQueue = (orderedKeys: string[]) => {
    setOrder((current) => {
      const completed = current.slice(0, exerciseIndex);
      const movable = current.slice(exerciseIndex);
      const byId = new Map(movable.map((item) => [item.id, item]));
      const reordered = orderedKeys.map((key) => byId.get(key)).filter((item): item is WorkoutExercise => !!item);
      return reordered.length === movable.length ? [...completed, ...reordered] : current;
    });
  };

  const beginEdit = (item: WorkoutExercise) => {
    setEditingDraft({
      id: item.id,
      name: item.name,
      kind: item.kind ?? 'reps',
      sets: item.sets.map((set) => ({ ...set })),
      restSec: item.restSec,
    });
  };

  const patchEditingDraft = (patch: Partial<ExerciseEditDraft>) => {
    setEditingDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const saveExerciseEdit = () => {
    const nextName = editingDraft?.name.trim();
    if (!editingDraft || !nextName || editingDraft.sets.length === 0) return;
    const nextExercise: WorkoutExercise = {
      id: editingDraft.id,
      name: nextName,
      kind: editingDraft.kind,
      sets: editingDraft.sets,
      restSec: editingDraft.restSec,
      lastTime: order.find((item) => item.id === editingDraft.id)?.lastTime ?? null,
    };

    setOrder((current) => current.map((item) => (item.id === editingDraft.id ? nextExercise : item)));
    if (exercise.id === editingDraft.id) {
      const nextSetIndex = Math.min(setIndex, nextExercise.sets.length - 1);
      const target = nextExercise.sets[nextSetIndex];
      setSetIndex(nextSetIndex);
      if (target) {
        setReps(target.reps ?? 0);
        setWeight(target.weight ?? 0);
        setDurationSec(target.durationSec ?? 0);
      }
    }
    setEditingDraft(null);
  };

  if (phase === 'finished') {
    const session = finishedSession ?? buildSession(logged);
    const totalWeightLifted = session.exercises.reduce(
      (sum, item) =>
        sum + item.sets.reduce((setSum, set) => setSum + (set.skipped ? 0 : (set.reps ?? 0) * (set.weight ?? 0)), 0),
      0,
    );
    const comparison = describeWeightComparison(totalWeightLifted);
    const prNames = new Set(sessionPRs.map((pr) => pr.name));

    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.finishedHeader}>
            <ThemedText type="title">Workout finished!</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Nice work — here’s how it went.
            </ThemedText>
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.finishedContent} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryRow}>
              <SummaryStat animatedValue={session.durationMinutes} unit="min" label="Duration" />
              <SummaryStat
                animatedValue={session.calories ?? workoutCalories}
                unit="cal"
                label="Calories"
                icon="flame.fill"
              />
              <SummaryStat animatedValue={completedSets} unit="sets" label="Completed" />
            </View>

            {totalWeightLifted > 0 && (
              <View style={styles.funCard}>
                <ThemedText type="label" style={{ color: colors.onPrimaryDim }}>
                  TOTAL WEIGHT MOVED
                </ThemedText>
                <ThemedText type="statLarge" style={{ color: colors.onPrimary }}>
                  {formatWeight(totalWeightLifted, unitSystem)}
                </ThemedText>
                {comparison ? (
                  <ThemedText type="small" style={{ color: colors.onPrimaryDim }}>
                    {comparison.emoji} About as much as {comparison.label}
                  </ThemedText>
                ) : null}
              </View>
            )}

            {sessionPRs.length > 0 && (
              <View style={styles.prSection}>
                <ThemedText type="label" themeColor="textSecondary">
                  NEW PRS
                </ThemedText>
                {sessionPRs.map((pr) => (
                  <View key={pr.name} style={styles.prRow}>
                    <View style={styles.prRowBadge}>
                      <SymbolView name="trophy.fill" size={13} tintColor={colors.onPrimary} />
                    </View>
                    <ThemedText type="smallBold" style={styles.flex}>
                      {pr.name}
                    </ThemedText>
                    <ThemedText type="statInline" themeColor="primary">
                      {formatSetLog({ reps: pr.reps, weight: pr.weight }, unitSystem)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.finishedList}>
              {session.exercises.map((item) => (
                <ThemedView key={item.exerciseId} type="surface" style={styles.finishedExercise}>
                  <View style={styles.finishedExerciseName}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    {prNames.has(item.name) ? (
                      <SymbolView name="trophy.fill" size={13} tintColor={colors.primary} />
                    ) : null}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.sets.filter((set) => !set.skipped).length} sets
                  </ThemedText>
                </ThemedView>
              ))}
            </View>
          </ScrollView>

          <Pressable style={styles.primaryButton} onPress={() => router.dismissTo('/dashboard')}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Return to Home
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'exerciseReady') {
    const movable = order.slice(exerciseIndex);

    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {routine.name}
            </ThemedText>
            <Pressable onPress={startedAt ? confirmEnd : () => router.back()} hitSlop={12}>
              <ThemedText type="small" themeColor="textSecondary">
                {startedAt ? 'End' : 'Cancel'}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.exerciseHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              NEXT EXERCISE
            </ThemedText>
            <ThemedText type="subtitle">{exercise.name}</ThemedText>
            <MuscleChips groups={muscleGroups} />
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.checklist}>
            {order.slice(0, exerciseIndex).map((item) => (
              <ExerciseStatusRow key={item.id} item={item} index={order.indexOf(item)} status="done" unitSystem={unitSystem} />
            ))}
            <SortableList
              items={movable}
              keyFor={(item) => item.id}
              rowHeight={QUEUE_ROW_HEIGHT}
              onOrderChange={reorderQueue}
              renderRow={(item, dragHandle) => {
                const absoluteIndex = order.findIndex((candidate) => candidate.id === item.id);
                return (
                  <EditableExerciseRow
                    item={item}
                    index={absoluteIndex}
                    active={absoluteIndex === exerciseIndex}
                    editing={editingDraft?.id === item.id}
                    onBeginEdit={() => beginEdit(item)}
                    unitSystem={unitSystem}
                    dragHandle={dragHandle}
                  />
                );
              }}
            />
          </ScrollView>

          <Pressable style={styles.primaryButton} onPress={startExercise}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Start Exercise
            </ThemedText>
          </Pressable>
        </SafeAreaView>

        <Modal
          visible={editingDraft !== null}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setEditingDraft(null)}>
          {editingDraft && (
            <ExerciseEditModal
              draft={editingDraft}
              unitSystem={unitSystem}
              onChangeDraft={patchEditingDraft}
              onCancel={() => setEditingDraft(null)}
              onSave={saveExerciseEdit}
            />
          )}
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <View style={styles.progressBar}>
            {Array.from({ length: plannedSetCount }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor:
                      index < setIndex || (index === setIndex && phase !== 'setPending')
                        ? colors.primary
                        : colors.surfaceElevated,
                  },
                ]}
              />
            ))}
          </View>
          <Pressable onPress={confirmEnd} hitSlop={12}>
            <ThemedText type="small" themeColor="textSecondary">
              End
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.exerciseHeader}>
          <ThemedText type="label">
            {formatCurrentSetLabel(exercise.sets, setIndex).toUpperCase()}
          </ThemedText>
          <ThemedText type="subtitle">{exercise.name}</ThemedText>
          <MuscleChips groups={muscleGroups} />
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.phaseBodyContent} showsVerticalScrollIndicator={false}>
          {phase === 'setPending' && activeSet && (
            <>
              <TargetCard
                exercise={exercise}
                kind={exerciseKind}
                isWarmup={isWarmupSet}
                set={activeSet}
                restSec={exercise.restSec}
                unitSystem={unitSystem}
                lastSet={lastMatchingSet}
                personalRecord={personalRecord}
              />
              <SetRoadmap sets={exercise.sets} setIndex={setIndex} unitSystem={unitSystem} />
            </>
          )}

          {phase === 'setActive' && exerciseKind === 'reps' && (
            <View style={styles.stopwatchArea}>
              <ThemedText type="label" themeColor="textSecondary">
                SET IN PROGRESS
              </ThemedText>
              <TimerText seconds={currentSetElapsedSec} size="lg" />
            </View>
          )}

          {phase === 'setLogging' && (
            <View style={styles.setLoggingArea}>
              <SetLogCard
                label="Reps"
                value={reps}
                targetValue={activeSet?.reps}
                min={1}
                max={Math.max((activeSet?.reps ?? 0) * 2, 20)}
                step={1}
                onChange={setReps}
              />
              <SetLogCard
                label="Weight"
                value={toDisplayWeight(weight, unitSystem)}
                unit={weightUnitLabel(unitSystem)}
                targetValue={activeSet ? toDisplayWeight(activeSet.weight ?? 0, unitSystem) : undefined}
                min={0}
                max={Math.max(toDisplayWeight(activeSet?.weight ?? 0, unitSystem) * 2, unitSystem === 'metric' ? 45 : 100)}
                step={unitSystem === 'metric' ? 1 : 2.5}
                onChange={(displayValue) => setWeight(fromDisplayWeight(displayValue, unitSystem))}
                quickValues={weightQuickValues}
              />
            </View>
          )}

          {phase === 'setActive' && exerciseKind === 'time' && (
            <CountdownTimer
              key={`${exercise.id}-${setIndex}`}
              seconds={timerSeconds}
              label="WORK"
              onDone={() => completeSet({ kind: 'time', durationSec })}
            />
          )}

          {phase === 'resting' && (
            <CountdownTimer
              key={`rest-${exercise.id}-${setIndex}`}
              seconds={timerSeconds}
              label="REST"
              nextLabel={
                !isLastSet
                  ? formatCurrentSetLabel(exercise.sets, setIndex + 1)
                  : order[exerciseIndex + 1]?.name ?? ''
              }
              onDone={advanceAfterRest}
              skippable
            />
          )}
        </ScrollView>

        {phase === 'setPending' && (
          <>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryButton} onPress={skipSet}>
                <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                  Skip Set
                </ThemedText>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.flex]} onPress={startSet}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  Start Set
                </ThemedText>
              </Pressable>
            </View>
            <Pressable style={styles.skipExerciseRow} onPress={confirmSkipExercise}>
              <ThemedText type="small" themeColor="textSecondary">
                Skip this exercise
              </ThemedText>
            </Pressable>
          </>
        )}

        {phase === 'setActive' && exerciseKind === 'reps' && (
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              haptics.impact();
              setPhase('setLogging');
            }}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Complete Set
            </ThemedText>
          </Pressable>
        )}

        {phase === 'setLogging' && (
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              haptics.impact();
              completeSet();
            }}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Log Set
            </ThemedText>
          </Pressable>
        )}

        <View style={styles.bottomBar}>
          <View style={styles.overallTrack}>
            <View style={[styles.overallFill, { width: `${Math.round(overallProgress * 100)}%` }]} />
          </View>
          <View style={styles.bottomStats}>
            <ThemedText type="small" themeColor="textSecondary">
              <ThemedText type="statInline">{Math.round(overallProgress * 100)}%</ThemedText> complete
            </ThemedText>
            <TimerText seconds={elapsedSec} size="xs" />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function MuscleChips({ groups }: { groups: string[] }) {
  if (groups.length === 0) return null;
  return (
    <View style={styles.muscleChips}>
      {groups.map((group) => (
        <View key={group} style={styles.muscleChip}>
          <ThemedText type="small" style={{ color: colors.primaryLight }}>
            {group}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function TargetCard({
  exercise,
  kind,
  isWarmup,
  set,
  restSec,
  unitSystem,
  lastSet,
  personalRecord,
}: {
  exercise: WorkoutExercise;
  kind: 'reps' | 'time';
  isWarmup: boolean;
  set: RoutineSet;
  restSec: number;
  unitSystem: UnitSystem;
  lastSet: SetLog | null;
  personalRecord: { weight: number; reps?: number; date: string } | null;
}) {
  const isPRAttempt =
    !isWarmup && kind === 'reps' && personalRecord !== null && (set.weight ?? 0) > personalRecord.weight;

  return (
    <ThemedView type="surface" style={styles.targetCard}>
      {isPRAttempt ? (
        <View style={styles.prBadge}>
          <ThemedText type="smallBold" style={styles.prBadgeText}>
            PR ATTEMPT
          </ThemedText>
        </View>
      ) : null}
      {isWarmup ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.lastTime}>
          WARM-UP
        </ThemedText>
      ) : null}
      {kind === 'time' ? (
        <View style={styles.targetColumn}>
          <ThemedText type="statLarge" style={styles.targetValue}>
            {formatDuration(set.durationSec ?? 0)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            target time
          </ThemedText>
        </View>
      ) : (
        <View style={styles.targetRow}>
          <View style={styles.targetColumn}>
            <ThemedText type="statLarge" style={styles.targetValue}>
              {set.reps ?? 0}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              target reps
            </ThemedText>
          </View>
          <View style={styles.targetDivider} />
          <View style={styles.targetColumn}>
            <ThemedText type="statLarge" style={styles.targetValue}>
              {toDisplayWeight(set.weight ?? 0, unitSystem)}
              <ThemedText type="small" style={{ color: colors.primaryLight }}>
                {' '}
                {weightUnitLabel(unitSystem)}
              </ThemedText>
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              target weight
            </ThemedText>
          </View>
        </View>
      )}
      {/* These are the numbers you're training against — the caption stays
          secondary, but every value reads at full contrast. */}
      {lastSet ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.lastTime}>
          Last session, this set:{' '}
          <ThemedText type="statInline">{formatSetLog(lastSet, unitSystem)}</ThemedText>
        </ThemedText>
      ) : exercise.lastTime ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.lastTime}>
          Last time:{' '}
          <ThemedText type="statInline">{formatSetLog(exercise.lastTime, unitSystem)}</ThemedText>
        </ThemedText>
      ) : null}
      {personalRecord && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.lastTime}>
          Best ever:{' '}
          <ThemedText type="statInline" themeColor="primary">
            {personalRecord.reps
              ? formatSetLog({ reps: personalRecord.reps, weight: personalRecord.weight }, unitSystem)
              : formatWeight(personalRecord.weight, unitSystem)}
          </ThemedText>
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.lastTime}>
        Rest: <ThemedText type="statInline">{formatDuration(restSec)}</ThemedText>
      </ThemedText>
    </ThemedView>
  );
}

/** The rest of this exercise's planned sets — turns the pre-set screen's blank space into a mini agenda. */
function SetRoadmap({
  sets,
  setIndex,
  unitSystem,
}: {
  sets: RoutineSet[];
  setIndex: number;
  unitSystem: UnitSystem;
}) {
  if (sets.length <= 1) return null;
  return (
    <View style={styles.roadmap}>
      <ThemedText type="label" themeColor="textSecondary">
        THIS EXERCISE
      </ThemedText>
      {sets.map((set, index) => {
        const done = index < setIndex;
        const current = index === setIndex;
        return (
          <View key={set.id} style={styles.roadmapRow}>
            <View style={[styles.roadmapIcon, done && styles.roadmapIconDone, current && styles.roadmapIconCurrent]}>
              {done ? (
                <SymbolView name="checkmark" size={11} tintColor={colors.onPrimary} />
              ) : (
                <ThemedText type="caption" themeColor="textSecondary">
                  {index + 1}
                </ThemedText>
              )}
            </View>
            <ThemedText type="small" themeColor={current ? 'text' : 'textSecondary'} style={styles.flex}>
              {set.isWarmup ? 'Warm-up · ' : ''}
              {formatSetLog(set, unitSystem)}
            </ThemedText>
            {current ? (
              <ThemedText type="caption" themeColor="primary">
                NOW
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function EditableExerciseRow({
  item,
  index,
  active,
  editing,
  onBeginEdit,
  unitSystem,
  dragHandle,
}: {
  item: WorkoutExercise;
  index: number;
  active: boolean;
  editing: boolean;
  onBeginEdit: () => void;
  unitSystem: UnitSystem;
  dragHandle: ReactNode;
}) {
  return (
    <View style={styles.editRow}>
      <ExerciseStatusRow item={item} index={index} status={active ? 'current' : 'upcoming'} unitSystem={unitSystem} />
      <Pressable hitSlop={8} onPress={onBeginEdit}>
        <SymbolView name="pencil" size={16} tintColor={editing ? colors.primaryLight : colors.textSecondary} />
      </Pressable>
      {dragHandle}
    </View>
  );
}

function ExerciseEditModal({
  draft,
  unitSystem,
  onChangeDraft,
  onCancel,
  onSave,
}: {
  draft: ExerciseEditDraft;
  unitSystem: UnitSystem;
  onChangeDraft: (patch: Partial<ExerciseEditDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const canSave = draft.name.trim().length > 0 && draft.sets.length > 0;
  return (
    <SafeAreaProvider>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.editHeaderRow}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <ThemedText type="link" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold">Edit Exercise</ThemedText>
            <Pressable onPress={onSave} hitSlop={12} disabled={!canSave}>
              <ThemedText type="link" style={{ color: colors.primaryLight, opacity: canSave ? 1 : 0.4 }}>
                Save
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.editModalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.replacementInput}
              value={draft.name}
              onChangeText={(name) => onChangeDraft({ name })}
              placeholder="Exercise name"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <ModeToggle kind={draft.kind} onChange={(kind) => onChangeDraft({ kind })} />
            <ExerciseSetEditor
              sets={draft.sets}
              onChangeSets={(sets) => onChangeDraft({ sets })}
              kind={draft.kind}
              restSec={draft.restSec}
              onChangeRestSec={(restSec) => onChangeDraft({ restSec })}
              unitSystem={unitSystem}
            />
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </SafeAreaProvider>
  );
}

function ExerciseStatusRow({
  item,
  index,
  status,
  unitSystem,
}: {
  item: WorkoutExercise;
  index: number;
  status: 'done' | 'current' | 'upcoming';
  unitSystem: UnitSystem;
}) {
  const isDone = status === 'done';
  const isCurrent = status === 'current';
  return (
    <View style={styles.statusRow}>
      <View
        style={[
          styles.statusIcon,
          isDone && { backgroundColor: colors.primary },
          isCurrent && { borderColor: colors.primary },
        ]}>
        {isDone ? (
          <SymbolView name="checkmark" size={12} tintColor={colors.onPrimary} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {index + 1}
          </ThemedText>
        )}
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {describeExerciseSets(item, unitSystem)}
        </ThemedText>
      </View>
    </View>
  );
}

function ModeToggle({ kind, onChange }: { kind: ExerciseKind; onChange: (kind: ExerciseKind) => void }) {
  return (
    <View style={styles.modeToggle}>
      {(['reps', 'time'] as ExerciseKind[]).map((option) => {
        const active = kind === option;
        return (
          <Pressable
            key={option}
            style={[styles.modeButton, active && styles.modeButtonActive]}
            onPress={() => onChange(option)}>
            <ThemedText type="smallBold" style={active ? styles.modeTextActive : undefined}>
              {option === 'reps' ? 'Reps' : 'Time'}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SetLogCard({
  label,
  value,
  min,
  max,
  step,
  unit,
  targetValue,
  quickValues,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  targetValue?: number;
  quickValues?: number[];
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatStepperValue(value));

  const commitDraft = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      onChange(clampToStep(parsed, min, max, step));
    }
    setEditing(false);
  };

  const changeBy = (delta: number) => {
    onChange(clampToStep(value + delta, min, max, step));
  };

  const unitSuffix = unit ? ` ${unit}` : '';
  const delta = targetValue !== undefined ? Number((value - targetValue).toFixed(2)) : null;
  const deltaLabel =
    targetValue === undefined
      ? null
      : delta === 0
        ? `vs ${formatStepperValue(targetValue)}${unitSuffix}`
        : `${delta! > 0 ? '+' : ''}${formatStepperValue(delta!)}${unitSuffix}`;
  const hasQuickValues = !!quickValues && quickValues.length > 0;

  return (
    <ThemedView type="surface" style={styles.setLogCard}>
      <View style={styles.setLogCardHeader}>
        <ThemedText type="label" themeColor="textSecondary">
          {label.toUpperCase()}
        </ThemedText>
        {deltaLabel ? (
          <ThemedText type="small" themeColor={delta ? 'primary' : 'textSecondary'}>
            {deltaLabel}
          </ThemedText>
        ) : null}
      </View>

      {editing ? (
        <TextInput
          style={styles.setLogValueInput}
          value={draft}
          onChangeText={setDraft}
          onBlur={commitDraft}
          onSubmitEditing={commitDraft}
          keyboardType="decimal-pad"
          selectTextOnFocus
          autoFocus
        />
      ) : (
        <Pressable
          onPress={() => {
            setDraft(formatStepperValue(value));
            setEditing(true);
          }}>
          <ThemedText type="statLarge" style={styles.setLogValue}>
            {formatStepperValue(value)}
            {unit ? (
              <ThemedText type="small" style={{ color: colors.primaryLight }}>
                {' '}
                {unit}
              </ThemedText>
            ) : null}
          </ThemedText>
        </Pressable>
      )}

      <View style={[styles.setLogControls, !hasQuickValues && styles.setLogControlsCentered]}>
        <Pressable style={styles.setStepperButton} onPress={() => changeBy(-step)}>
          <SymbolView name="minus" size={18} tintColor={colors.text} />
        </Pressable>
        {hasQuickValues ? (
          <View style={styles.quickChipRow}>
            {quickValues!.map((quickValue) => {
              const active = value === quickValue;
              return (
                <Pressable
                  key={quickValue}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                  onPress={() => {
                    haptics.selection();
                    onChange(quickValue);
                  }}>
                  <ThemedText type="small" style={active ? styles.quickChipTextActive : styles.quickChipText}>
                    {formatStepperValue(quickValue)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Pressable style={styles.setStepperButton} onPress={() => changeBy(step)}>
          <SymbolView name="plus" size={18} tintColor={colors.text} />
        </Pressable>
      </View>
    </ThemedView>
  );
}

function formatSetLog(set: { reps?: number; weight?: number; durationSec?: number }, unitSystem: UnitSystem): string {
  if (set.durationSec !== undefined) return formatDuration(set.durationSec);
  const weightLabel = set.weight ? ` × ${toDisplayWeight(set.weight, unitSystem)} ${weightUnitLabel(unitSystem)}` : '';
  return `${set.reps ?? 0} reps${weightLabel}`;
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
  phaseBodyContent: {
    flexGrow: 1,
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
  progressBar: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  exerciseHeader: {
    gap: Spacing.half,
  },
  muscleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  muscleChip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.full,
    backgroundColor: colors.primaryTint,
  },
  checklist: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  statusRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  statusIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  editModalContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  replacementInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.half,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeTextActive: {
    color: colors.onPrimary,
  },
  targetCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.four,
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  prBadge: {
    alignSelf: 'center',
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
  },
  prBadgeText: {
    color: colors.onPrimary,
    letterSpacing: 0.6,
  },
  targetRow: {
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
    color: colors.primaryLight,
  },
  targetDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  lastTime: {
    textAlign: 'center',
  },
  roadmap: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  roadmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  roadmapIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapIconDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  roadmapIconCurrent: {
    borderColor: colors.primary,
  },
  stopwatchArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  setLoggingArea: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  setLogCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  setLogCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  setLogValue: {
    fontSize: 40,
    lineHeight: 44,
    color: colors.primaryLight,
  },
  setLogValueInput: {
    minWidth: 140,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    textAlign: 'center',
    fontSize: 34,
    lineHeight: 38,
    color: colors.primaryLight,
    backgroundColor: colors.surfaceElevated,
  },
  setLogControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  setLogControlsCentered: {
    justifyContent: 'center',
    gap: Spacing.four,
  },
  setStepperButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  quickChipActive: {
    backgroundColor: colors.primary,
  },
  quickChipText: {
    color: colors.textSecondary,
  },
  quickChipTextActive: {
    color: colors.onPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  skipExerciseRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  secondaryButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
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
  bottomBar: {
    gap: Spacing.one,
  },
  overallTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  overallFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  bottomStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  finishedHeader: {
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
  finishedContent: {
    gap: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  funCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  prSection: {
    gap: Spacing.two,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  prRowBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedList: {
    gap: Spacing.two,
  },
  finishedExercise: {
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  finishedExerciseName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
