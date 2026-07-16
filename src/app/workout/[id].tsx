import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import Svg, { Circle } from 'react-native-svg';

import { ActivityRings } from '@/components/activity-rings';
import { GradientFill } from '@/components/gradient-fill';
import { SortableList } from '@/components/sortable-list';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, RingColors, Spacing } from '@/constants/theme';
import { currentGoalValue, todayKey } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { ExerciseKind, RoutineExercise, Session, SessionExercise, SetLog, UnitSystem } from '@/lib/store/types';
import { clampToStep, formatStepperValue } from '@/lib/stepper-math';
import { fromDisplayWeight, toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const REST_SECONDS = 30;
const QUEUE_ROW_HEIGHT = 56;

type SessionPhase = 'exerciseReady' | 'setPending' | 'setActive' | 'resting' | 'finished';
type WorkoutExercise = RoutineExercise & { targetRestSec?: number };

interface ExerciseEditDraft {
  id: string;
  name: string;
  kind: ExerciseKind;
  warmupSets: number;
  warmupTargetReps: number;
  warmupTargetWeight: number;
  warmupTargetDurationSec: number;
  warmupRestSec: number;
  sets: number;
  targetReps: number;
  targetWeight: number;
  targetDurationSec: number;
  targetRestSec: number;
}

function toWorkoutExercise(exercise: RoutineExercise): WorkoutExercise {
  return {
    ...exercise,
    kind: exercise.kind ?? 'reps',
    warmupSets: exercise.warmupSets ?? 0,
    warmupTargetReps: exercise.warmupTargetReps ?? exercise.targetReps,
    warmupTargetWeight: exercise.warmupTargetWeight ?? 0,
    warmupTargetDurationSec: exercise.warmupTargetDurationSec ?? exercise.targetDurationSec ?? 30,
    warmupRestSec: exercise.warmupRestSec ?? exercise.targetRestSec ?? REST_SECONDS,
    targetDurationSec: exercise.targetDurationSec ?? 45,
    targetRestSec: exercise.targetRestSec ?? REST_SECONDS,
  };
}

function totalPlannedSets(exercise: WorkoutExercise): number {
  return (exercise.warmupSets ?? 0) + exercise.sets;
}

function setTargetsFor(exercise: WorkoutExercise, isWarmup: boolean) {
  return isWarmup
    ? {
        reps: exercise.warmupTargetReps ?? exercise.targetReps,
        weight: exercise.warmupTargetWeight ?? 0,
        durationSec: exercise.warmupTargetDurationSec ?? exercise.targetDurationSec ?? 30,
        restSec: exercise.warmupRestSec ?? exercise.targetRestSec ?? REST_SECONDS,
      }
    : {
        reps: exercise.targetReps,
        weight: exercise.targetWeight,
        durationSec: exercise.targetDurationSec ?? 45,
        restSec: exercise.targetRestSec ?? REST_SECONDS,
      };
}

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, sessions, cardioSessions, goals, waterEntries, addSession, preferences } = useStore();
  const unitSystem = preferences.unitSystem;
  const routine = routines.find((r) => r.id === id);

  const [order, setOrder] = useState<WorkoutExercise[]>(routine?.exercises.map(toWorkoutExercise) ?? []);
  const [phase, setPhase] = useState<SessionPhase>('exerciseReady');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [logged, setLogged] = useState<SessionExercise[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [reps, setReps] = useState(routine?.exercises[0]?.targetReps ?? 10);
  const [weight, setWeight] = useState(routine?.exercises[0]?.targetWeight ?? 0);
  const [durationSec, setDurationSec] = useState(routine?.exercises[0]?.targetDurationSec ?? 45);
  const [editingDraft, setEditingDraft] = useState<ExerciseEditDraft | null>(null);
  const [finishedSession, setFinishedSession] = useState<Session | null>(null);

  useEffect(() => {
    if (startedAt === null || phase === 'finished') return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startedAt]);

  const exercise = order[exerciseIndex];

  if (!routine || !exercise) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Workout not found</ThemedText>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <GradientFill />
            <ThemedText style={styles.primaryButtonText}>Back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const exerciseKind = exercise.kind ?? 'reps';
  const totalSets = order.reduce((sum, item) => sum + totalPlannedSets(item), 0);
  const completedSets = logged.reduce((sum, item) => sum + item.sets.filter((set) => !set.skipped).length, 0);
  const attemptedSets = logged.reduce((sum, item) => sum + item.sets.length, 0);
  const overallProgress = totalSets > 0 ? attemptedSets / totalSets : 0;
  const warmupSetCount = exercise.warmupSets ?? 0;
  const isWarmupSet = setIndex < warmupSetCount;
  const activeSetTargets = setTargetsFor(exercise, isWarmupSet);
  const plannedSetCount = totalPlannedSets(exercise);
  const isLastSet = setIndex + 1 >= plannedSetCount;
  const isLastExercise = exerciseIndex + 1 >= order.length;
  const workoutCalories = Math.max(1, Math.round(elapsedSec / 60)) * 8;

  const startExercise = () => {
    setStartedAt((value) => value ?? Date.now());
    const targets = setTargetsFor(exercise, (exercise.warmupSets ?? 0) > 0);
    setReps(targets.reps);
    setWeight(targets.weight);
    setDurationSec(targets.durationSec);
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

    if (isLastSet && isLastExercise) {
      finishWorkout(next);
    } else if (isLastSet) {
      setPhase('resting');
    } else {
      setPhase('resting');
    }
  };

  const skipSet = () => {
    const warmupFlag = isWarmupSet || undefined;
    completeSet(
      exerciseKind === 'time'
        ? { kind: 'time', durationSec: 0, isWarmup: warmupFlag, skipped: true }
        : { kind: 'reps', isWarmup: warmupFlag, skipped: true },
    );
  };

  const advanceAfterRest = () => {
    if (!isLastSet) {
      const nextSetIndex = setIndex + 1;
      const nextTargets = setTargetsFor(exercise, nextSetIndex < warmupSetCount);
      setSetIndex(nextSetIndex);
      setReps(nextTargets.reps);
      setWeight(nextTargets.weight);
      setDurationSec(nextTargets.durationSec);
      setPhase('setPending');
      return;
    }

    const upcoming = order[exerciseIndex + 1];
    if (upcoming) {
      setExerciseIndex((index) => index + 1);
      setSetIndex(0);
      const upcomingTargets = setTargetsFor(upcoming, (upcoming.warmupSets ?? 0) > 0);
      setReps(upcomingTargets.reps);
      setWeight(upcomingTargets.weight);
      setDurationSec(upcomingTargets.durationSec);
      setPhase('exerciseReady');
    }
  };

  const buildSession = (finalLogged: SessionExercise[]): Session => {
    const durationMinutes = Math.max(1, Math.round(elapsedSec / 60));
    return {
      id: makeId(),
      routineId: routine.id,
      routineName: routine.name,
      date: todayKey(),
      durationMinutes,
      calories: durationMinutes * 8,
      exercises: finalLogged.filter((item) => item.sets.some((set) => !set.skipped)),
    };
  };

  const finishWorkout = (finalLogged: SessionExercise[]) => {
    const session = buildSession(finalLogged);
    if (session.exercises.length > 0) addSession(session);
    setFinishedSession(session);
    setPhase('finished');
  };

  const confirmEnd = () => {
    Alert.alert('End workout early?', 'Your completed sets will be saved and skipped sets will be ignored.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'End workout',
        style: 'destructive',
        onPress: () => {
          if (logged.some((item) => item.sets.some((set) => !set.skipped))) {
            finishWorkout(logged);
          } else {
            router.dismissTo('/dashboard');
          }
        },
      },
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
      warmupSets: item.warmupSets ?? 0,
      warmupTargetReps: item.warmupTargetReps ?? item.targetReps,
      warmupTargetWeight: item.warmupTargetWeight ?? 0,
      warmupTargetDurationSec: item.warmupTargetDurationSec ?? item.targetDurationSec ?? 30,
      warmupRestSec: item.warmupRestSec ?? item.targetRestSec ?? REST_SECONDS,
      sets: item.sets,
      targetReps: item.targetReps,
      targetWeight: item.targetWeight,
      targetDurationSec: item.targetDurationSec ?? 45,
      targetRestSec: item.targetRestSec ?? REST_SECONDS,
    });
  };

  const patchEditingDraft = (patch: Partial<ExerciseEditDraft>) => {
    setEditingDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const saveExerciseEdit = () => {
    const nextName = editingDraft?.name.trim();
    if (!editingDraft || !nextName) return;
    const nextExercise: WorkoutExercise = {
      id: editingDraft.id,
      name: nextName,
      kind: editingDraft.kind,
      warmupSets: editingDraft.warmupSets,
      warmupTargetReps: editingDraft.warmupTargetReps,
      warmupTargetWeight: editingDraft.warmupTargetWeight,
      warmupTargetDurationSec: editingDraft.warmupTargetDurationSec,
      warmupRestSec: editingDraft.warmupRestSec,
      sets: editingDraft.sets,
      targetReps: editingDraft.targetReps,
      targetWeight: editingDraft.targetWeight,
      targetDurationSec: editingDraft.targetDurationSec,
      targetRestSec: editingDraft.targetRestSec,
      lastTime: order.find((item) => item.id === editingDraft.id)?.lastTime ?? null,
    };

    setOrder((current) => current.map((item) => (item.id === editingDraft.id ? nextExercise : item)));
    if (exercise.id === editingDraft.id) {
      const nextTargets = setTargetsFor(nextExercise, setIndex < (nextExercise.warmupSets ?? 0));
      setReps(nextTargets.reps);
      setWeight(nextTargets.weight);
      setDurationSec(nextTargets.durationSec);
      setSetIndex((index) => Math.min(index, totalPlannedSets(nextExercise) - 1));
    }
    setEditingDraft(null);
  };

  if (phase === 'finished') {
    const session = finishedSession ?? buildSession(logged);
    const updatedSessions = [session, ...sessions];

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
            rings={goals.map((goal, index) => ({
              progress: currentGoalValue(goal, updatedSessions, cardioSessions, waterEntries) / goal.target,
              color: RingColors[index % RingColors.length],
              trackColor: colors.border,
            }))}
          />

          <View style={styles.summaryRow}>
            <SummaryStat value={`${session.durationMinutes}`} unit="min" label="Duration" />
            <SummaryStat value={`${session.calories ?? workoutCalories}`} unit="cal" label="Calories" />
            <SummaryStat value={`${completedSets}`} unit="sets" label="Completed" />
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.finishedList}>
            {session.exercises.map((item) => (
              <ThemedView key={item.exerciseId} type="surface" style={styles.finishedExercise}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.sets.filter((set) => !set.skipped).length} sets
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>

          <Pressable style={styles.primaryButton} onPress={() => router.dismissTo('/dashboard')}>
            <GradientFill />
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
              renderRow={(item) => {
                const absoluteIndex = order.findIndex((candidate) => candidate.id === item.id);
                return (
                  <EditableExerciseRow
                    item={item}
                    index={absoluteIndex}
                    active={absoluteIndex === exerciseIndex}
                    editing={editingDraft?.id === item.id}
                    onBeginEdit={() => beginEdit(item)}
                    unitSystem={unitSystem}
                  />
                );
              }}
            />
            {editingDraft ? (
              <ExerciseEditPanel
                draft={editingDraft}
                unitSystem={unitSystem}
                onChangeDraft={patchEditingDraft}
                onCancel={() => setEditingDraft(null)}
                onSave={saveExerciseEdit}
              />
            ) : null}
          </ScrollView>

          <Pressable style={styles.primaryButton} onPress={startExercise}>
            <GradientFill />
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Start Exercise
            </ThemedText>
          </Pressable>
        </SafeAreaView>
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
          <ThemedText type="smallBold" themeColor="textSecondary">
            {formatCurrentSetLabel(setIndex, warmupSetCount, exercise.sets).toUpperCase()}
          </ThemedText>
          <ThemedText type="subtitle">{exercise.name}</ThemedText>
        </View>

        <View style={styles.flex}>
          {phase === 'setPending' && (
            <TargetCard
              exercise={exercise}
              kind={exerciseKind}
              isWarmup={isWarmupSet}
              targets={activeSetTargets}
              unitSystem={unitSystem}
            />
          )}

          {phase === 'setActive' && exerciseKind === 'reps' && (
            <ThemedView type="surface" style={styles.setStepperCard}>
              <InlineStepper
                label="Reps"
                value={reps}
                min={1}
                max={Math.max(activeSetTargets.reps * 2, 20)}
                step={1}
                onChange={setReps}
              />
              <InlineStepper
                label="Weight"
                value={toDisplayWeight(weight, unitSystem)}
                min={0}
                max={Math.max(toDisplayWeight(activeSetTargets.weight, unitSystem) * 2, unitSystem === 'metric' ? 45 : 100)}
                step={unitSystem === 'metric' ? 1 : 2.5}
                unit={weightUnitLabel(unitSystem)}
                onChange={(displayValue) => setWeight(fromDisplayWeight(displayValue, unitSystem))}
              />
            </ThemedView>
          )}

          {phase === 'setActive' && exerciseKind === 'time' && (
            <CountdownTimer
              key={`${exercise.id}-${setIndex}`}
              seconds={durationSec}
              label="WORK"
              onDone={() => completeSet({ kind: 'time', durationSec })}
            />
          )}

          {phase === 'resting' && (
            <CountdownTimer
              key={`rest-${exercise.id}-${setIndex}`}
              seconds={activeSetTargets.restSec}
              label="REST"
              nextLabel={
                !isLastSet
                  ? formatCurrentSetLabel(setIndex + 1, warmupSetCount, exercise.sets)
                  : order[exerciseIndex + 1]?.name ?? ''
              }
              onDone={advanceAfterRest}
              skippable
            />
          )}
        </View>

        {phase === 'setPending' && (
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={skipSet}>
              <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                Skip Set
              </ThemedText>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.flex]} onPress={() => setPhase('setActive')}>
              <GradientFill />
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                Start Set
              </ThemedText>
            </Pressable>
          </View>
        )}

        {phase === 'setActive' && exerciseKind === 'reps' && (
          <Pressable style={styles.primaryButton} onPress={() => completeSet()}>
            <GradientFill />
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Complete Set
            </ThemedText>
          </Pressable>
        )}

        <View style={styles.bottomBar}>
          <View style={styles.overallTrack}>
            <View style={[styles.overallFill, { width: `${Math.round(overallProgress * 100)}%` }]} />
          </View>
          <View style={styles.bottomStats}>
            <ThemedText type="small" themeColor="textSecondary">
              {Math.round(overallProgress * 100)}% complete
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDuration(elapsedSec)}
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function TargetCard({
  exercise,
  kind,
  isWarmup,
  targets,
  unitSystem,
}: {
  exercise: WorkoutExercise;
  kind: 'reps' | 'time';
  isWarmup: boolean;
  targets: ReturnType<typeof setTargetsFor>;
  unitSystem: UnitSystem;
}) {
  return (
    <ThemedView type="surface" style={styles.targetCard}>
      {isWarmup ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.lastTime}>
          WARM-UP
        </ThemedText>
      ) : null}
      {kind === 'time' ? (
        <View style={styles.targetColumn}>
          <ThemedText type="title" style={styles.targetValue}>
            {formatDuration(targets.durationSec)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            target time
          </ThemedText>
        </View>
      ) : (
        <View style={styles.targetRow}>
          <View style={styles.targetColumn}>
            <ThemedText type="title" style={styles.targetValue}>
              {targets.reps}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              target reps
            </ThemedText>
          </View>
          <View style={styles.targetDivider} />
          <View style={styles.targetColumn}>
            <ThemedText type="title" style={styles.targetValue}>
              {toDisplayWeight(targets.weight, unitSystem)}
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
      {exercise.lastTime && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.lastTime}>
          Last time: {formatSetLog(exercise.lastTime, unitSystem)}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.lastTime}>
        Rest: {formatDuration(targets.restSec)}
      </ThemedText>
    </ThemedView>
  );
}

function EditableExerciseRow({
  item,
  index,
  active,
  editing,
  onBeginEdit,
  unitSystem,
}: {
  item: WorkoutExercise;
  index: number;
  active: boolean;
  editing: boolean;
  onBeginEdit: () => void;
  unitSystem: UnitSystem;
}) {
  return (
    <View style={styles.editRow}>
      <ExerciseStatusRow item={item} index={index} status={active ? 'current' : 'upcoming'} unitSystem={unitSystem} />
      <Pressable hitSlop={8} onPress={onBeginEdit}>
        <SymbolView name="pencil" size={16} tintColor={editing ? colors.primaryLight : colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function ExerciseEditPanel({
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
  const canSave = draft.name.trim().length > 0;
  return (
    <ThemedView type="surface" style={styles.editPanel}>
      <TextInput
        style={styles.replacementInput}
        value={draft.name}
        onChangeText={(name) => onChangeDraft({ name })}
        placeholder="Exercise name"
        placeholderTextColor={colors.textSecondary}
        autoFocus
      />
      <ModeToggle kind={draft.kind} onChange={(kind) => onChangeDraft({ kind })} />
      <View style={styles.editControls}>
        <View style={styles.editSetGroup}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            WARM-UP SETS
          </ThemedText>
          <Stepper
            label="Sets"
            value={draft.warmupSets}
            min={0}
            step={1}
            onChange={(warmupSets) => onChangeDraft({ warmupSets })}
          />
          {draft.warmupSets > 0 ? (
            draft.kind === 'time' ? (
              <Stepper
                label="Work"
                value={draft.warmupTargetDurationSec}
                min={5}
                step={5}
                suffix="sec"
                onChange={(warmupTargetDurationSec) => onChangeDraft({ warmupTargetDurationSec })}
              />
            ) : (
              <>
                <Stepper
                  label="Reps"
                  value={draft.warmupTargetReps}
                  min={1}
                  step={1}
                  onChange={(warmupTargetReps) => onChangeDraft({ warmupTargetReps })}
                />
                <Stepper
                  label="Weight"
                  value={toDisplayWeight(draft.warmupTargetWeight, unitSystem)}
                  min={0}
                  step={unitSystem === 'metric' ? 1 : 2.5}
                  suffix={weightUnitLabel(unitSystem)}
                  onChange={(displayWeight) => onChangeDraft({ warmupTargetWeight: fromDisplayWeight(displayWeight, unitSystem) })}
                />
              </>
            )
          ) : null}
          {draft.warmupSets > 0 ? (
            <Stepper
              label="Rest"
              value={draft.warmupRestSec}
              min={0}
              step={5}
              suffix="sec"
              onChange={(warmupRestSec) => onChangeDraft({ warmupRestSec })}
            />
          ) : null}
        </View>
        <View style={styles.editSetGroup}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            MAIN SETS
          </ThemedText>
          <Stepper label="Sets" value={draft.sets} min={1} step={1} onChange={(sets) => onChangeDraft({ sets })} />
          {draft.kind === 'time' ? (
            <Stepper
              label="Work"
              value={draft.targetDurationSec}
              min={5}
              step={5}
              suffix="sec"
              onChange={(targetDurationSec) => onChangeDraft({ targetDurationSec })}
            />
          ) : (
            <>
              <Stepper
                label="Reps"
                value={draft.targetReps}
                min={1}
                step={1}
                onChange={(targetReps) => onChangeDraft({ targetReps })}
              />
              <Stepper
                label="Weight"
                value={toDisplayWeight(draft.targetWeight, unitSystem)}
                min={0}
                step={unitSystem === 'metric' ? 1 : 2.5}
                suffix={weightUnitLabel(unitSystem)}
                onChange={(displayWeight) => onChangeDraft({ targetWeight: fromDisplayWeight(displayWeight, unitSystem) })}
              />
            </>
          )}
          <Stepper
            label="Rest"
            value={draft.targetRestSec}
            min={0}
            step={5}
            suffix="sec"
            onChange={(targetRestSec) => onChangeDraft({ targetRestSec })}
          />
        </View>
      </View>
      <View style={styles.editActions}>
        <Pressable hitSlop={8} onPress={onCancel}>
          <SymbolView name="xmark.circle.fill" size={22} tintColor={colors.textSecondary} />
        </Pressable>
        <Pressable hitSlop={8} onPress={onSave} disabled={!canSave}>
          <SymbolView name="checkmark.circle.fill" size={22} tintColor={canSave ? colors.primaryLight : colors.textSecondary} />
        </Pressable>
      </View>
    </ThemedView>
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
          <SymbolView name="checkmark" size={12} tintColor={colors.text} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {index + 1}
          </ThemedText>
        )}
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {describeExercise(item, unitSystem)}
        </ThemedText>
      </View>
    </View>
  );
}

function CountdownTimer({
  seconds,
  label,
  nextLabel,
  onDone,
  skippable,
}: {
  seconds: number;
  label: string;
  nextLabel?: string;
  onDone: () => void;
  skippable?: boolean;
}) {
  const endsAt = useRef<number | null>(null);
  const called = useRef(false);
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    endsAt.current ??= Date.now() + seconds * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil(((endsAt.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !called.current) {
        called.current = true;
        clearInterval(interval);
        onDone();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [onDone, seconds]);

  const size = 140;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds > 0 ? remaining / seconds : 0;

  return (
    <View style={styles.timerArea}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </Svg>
        <View style={styles.timerLabel}>
          <ThemedText type="subtitle">{formatDuration(remaining)}</ThemedText>
        </View>
      </View>
      {nextLabel ? (
        <ThemedText type="small" themeColor="textSecondary">
          Up next: {nextLabel}
        </ThemedText>
      ) : null}
      {skippable ? (
        <Pressable style={styles.skipButton} onPress={onDone}>
          <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
            Skip Rest
          </ThemedText>
        </Pressable>
      ) : null}
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

function InlineStepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
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

  return (
    <View style={styles.setStepperRow}>
      <View style={styles.setStepperLabelWrap}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {unit ? (
          <ThemedText type="small" themeColor="textSecondary">
            {unit}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.setStepperControls}>
        <Pressable style={styles.setStepperButton} onPress={() => changeBy(-step)}>
          <SymbolView name="minus" size={18} tintColor={colors.text} />
        </Pressable>
        {editing ? (
          <TextInput
            style={styles.setStepperInput}
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
            style={styles.setStepperValueButton}
            onPress={() => {
              setDraft(formatStepperValue(value));
              setEditing(true);
            }}>
            <ThemedText type="subtitle" style={styles.setStepperValue}>
              {formatStepperValue(value)}
            </ThemedText>
          </Pressable>
        )}
        <Pressable style={styles.setStepperButton} onPress={() => changeBy(step)}>
          <SymbolView name="plus" size={18} tintColor={colors.text} />
        </Pressable>
      </View>
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

function describeExercise(exercise: WorkoutExercise, unitSystem: UnitSystem): string {
  const mainRestLabel = `, ${formatDuration(exercise.targetRestSec ?? REST_SECONDS)} rest`;
  const warmupTargets = setTargetsFor(exercise, true);
  const warmupLabel = exercise.warmupSets
    ? `${exercise.warmupSets} warm-up x ${formatTargets(exercise, warmupTargets, unitSystem)} + `
    : '';
  if ((exercise.kind ?? 'reps') === 'time') {
    return `${warmupLabel}${exercise.sets} x ${formatDuration(exercise.targetDurationSec ?? 45)}${mainRestLabel}`;
  }
  const weightLabel =
    exercise.targetWeight > 0 ? ` @ ${toDisplayWeight(exercise.targetWeight, unitSystem)} ${weightUnitLabel(unitSystem)}` : '';
  return `${warmupLabel}${exercise.sets} x ${exercise.targetReps}${weightLabel}${mainRestLabel}`;
}

function formatTargets(exercise: WorkoutExercise, targets: ReturnType<typeof setTargetsFor>, unitSystem: UnitSystem): string {
  const restLabel = `, ${formatDuration(targets.restSec)} rest`;
  if ((exercise.kind ?? 'reps') === 'time') return `${formatDuration(targets.durationSec)}${restLabel}`;
  const weightLabel = targets.weight > 0 ? ` @ ${toDisplayWeight(targets.weight, unitSystem)} ${weightUnitLabel(unitSystem)}` : '';
  return `${targets.reps}${weightLabel}${restLabel}`;
}

function formatSetLog(set: { reps?: number; weight?: number; durationSec?: number }, unitSystem: UnitSystem): string {
  if (set.durationSec !== undefined) return formatDuration(set.durationSec);
  const weightLabel = set.weight ? ` @ ${toDisplayWeight(set.weight, unitSystem)} ${weightUnitLabel(unitSystem)}` : '';
  return `${set.reps ?? 0} reps${weightLabel}`;
}

function formatCurrentSetLabel(setIndex: number, warmupSets: number, workingSets: number): string {
  if (setIndex < warmupSets) return `Warm-up ${setIndex + 1} of ${warmupSets}`;
  return `Set ${setIndex - warmupSets + 1} of ${workingSets}`;
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
  editPanel: {
    flex: 1,
    gap: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.two,
  },
  replacementInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  editControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  editSetGroup: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
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
    color: colors.text,
  },
  targetCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    marginBottom: Spacing.three,
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
  setStepperCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.four,
    gap: Spacing.four,
    marginBottom: Spacing.three,
  },
  setStepperRow: {
    gap: Spacing.two,
  },
  setStepperLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setStepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  setStepperButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setStepperValueButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setStepperValue: {
    fontSize: 34,
    lineHeight: 38,
    color: colors.primaryLight,
  },
  setStepperInput: {
    flex: 1,
    minHeight: 58,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    textAlign: 'center',
    fontSize: 34,
    lineHeight: 38,
    color: colors.primaryLight,
    backgroundColor: colors.surfaceElevated,
  },
  timerArea: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  timerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.three,
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
    overflow: 'hidden',
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text,
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
    alignItems: 'center',
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
  finishedList: {
    gap: Spacing.two,
  },
  finishedExercise: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
