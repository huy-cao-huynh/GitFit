import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Chevron } from '@/components/chevron';
import { GlowBackground } from '@/components/glow-background';
import { SortableList } from '@/components/sortable-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { todayKey } from '@/lib/store/derive';
import { makeId } from '@/lib/store/storage';
import type { RoutineExercise, Session, SessionExercise } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const REST_SECONDS = 30;
const QUEUE_ROW_HEIGHT = 44;

type SetPhase = 'pending' | 'inProgress' | 'resting';

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, addSession } = useStore();
  const routine = routines.find((r) => r.id === id);

  const [order, setOrder] = useState<RoutineExercise[]>(routine?.exercises ?? []);
  const [phase, setWorkoutPhase] = useState<'idle' | 'active'>('idle');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [setPhase, setSetPhase] = useState<SetPhase>('pending');
  const [logged, setLogged] = useState<SessionExercise[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [reps, setReps] = useState(routine?.exercises[0]?.targetReps ?? 10);
  const [weight, setWeight] = useState(routine?.exercises[0]?.targetWeight ?? 0);
  const [queueExpanded, setQueueExpanded] = useState(false);

  // Elapsed time recomputes from the wall clock so backgrounding stays accurate.
  useEffect(() => {
    if (phase !== 'active' || startedAt === null) return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startedAt]);

  const exercise = order[exerciseIndex];

  if (!routine || !exercise) {
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

  const totalSets = order.reduce((sum, e) => sum + e.sets, 0);
  const completedSets = logged.reduce((sum, e) => sum + e.sets.length, 0);
  const overallProgress = totalSets > 0 ? completedSets / totalSets : 0;
  const isLastSet = setIndex + 1 >= exercise.sets;
  const isLastExercise = exerciseIndex + 1 >= order.length;
  const nextExercise = order[exerciseIndex + 1];
  const queue = order.slice(exerciseIndex + 1);

  const appendLog = (current: SessionExercise[]): SessionExercise[] => {
    const existing = current.find((e) => e.exerciseId === exercise.id);
    if (existing) {
      return current.map((e) =>
        e.exerciseId === exercise.id ? { ...e, sets: [...e.sets, { reps, weight }] } : e,
      );
    }
    return [...current, { exerciseId: exercise.id, name: exercise.name, sets: [{ reps, weight }] }];
  };

  const finishWorkout = (finalLogged: SessionExercise[]) => {
    const durationMinutes = Math.max(1, Math.round(elapsedSec / 60));
    const session: Session = {
      id: makeId(),
      routineId: routine.id,
      routineName: routine.name,
      date: todayKey(),
      durationMinutes,
      calories: durationMinutes * 8,
      exercises: finalLogged,
    };
    if (finalLogged.length > 0) addSession(session);
    router.back();
  };

  const startWorkout = () => {
    setWorkoutPhase('active');
    setStartedAt(Date.now());
    setReps(exercise.targetReps);
    setWeight(exercise.targetWeight);
  };

  const completeSet = () => {
    const next = appendLog(logged);
    setLogged(next);
    if (isLastSet && isLastExercise) {
      finishWorkout(next);
    } else {
      setSetPhase('resting');
    }
  };

  const advanceAfterRest = () => {
    if (!isLastSet) {
      setSetIndex(setIndex + 1);
    } else {
      const upcoming = order[exerciseIndex + 1];
      setExerciseIndex(exerciseIndex + 1);
      setSetIndex(0);
      if (upcoming) {
        setReps(upcoming.targetReps);
        setWeight(upcoming.targetWeight);
      }
    }
    setSetPhase('pending');
  };

  const handleEnd = () => {
    if (phase === 'active' && completedSets > 0) {
      finishWorkout(logged);
    } else {
      router.back();
    }
  };

  const reorderQueue = (orderedKeys: string[]) => {
    setOrder((current) => {
      const head = current.slice(0, exerciseIndex + 1);
      const tail = current.slice(exerciseIndex + 1);
      const byId = new Map(tail.map((e) => [e.id, e]));
      const newTail = orderedKeys.map((key) => byId.get(key)).filter((e): e is RoutineExercise => !!e);
      return newTail.length === tail.length ? [...head, ...newTail] : current;
    });
  };

  if (phase === 'idle') {
    return (
      <View style={styles.container}>
        <GlowBackground variant="session" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topRow}>
            <View style={styles.flex} />
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ThemedText type="small" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {routine.exercises.length} exercises · {routine.durationMinutes} min · {routine.level}
          </ThemedText>
          <ThemedText type="subtitle">{routine.name}</ThemedText>

          <ScrollView style={styles.flex} contentContainerStyle={styles.overviewList}>
            {order.map((item, index) => (
              <View key={item.id} style={styles.overviewRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.overviewIndex}>
                  {index + 1}
                </ThemedText>
                <ThemedText type="small" style={styles.flex}>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.sets} × {item.targetReps}
                  {item.targetWeight > 0 ? ` @ ${item.targetWeight} lbs` : ''}
                </ThemedText>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.primaryButton} onPress={startWorkout}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Start Workout
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
          <View style={styles.progressBar}>
            {Array.from({ length: exercise.sets }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor:
                      index < setIndex || (index === setIndex && setPhase !== 'pending')
                        ? colors.accent
                        : colors.backgroundSelected,
                  },
                ]}
              />
            ))}
          </View>
          <Pressable onPress={handleEnd} hitSlop={12}>
            <ThemedText type="small" themeColor="textSecondary">
              End
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.exerciseHeader}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            SET {setIndex + 1} OF {exercise.sets}
          </ThemedText>
          <ThemedText type="subtitle">{exercise.name}</ThemedText>
        </View>

        <View style={styles.flex}>
          {setPhase === 'pending' && (
            <ThemedView type="backgroundElement" style={styles.targetCard}>
              <View style={styles.targetRow}>
                <View style={styles.targetColumn}>
                  <ThemedText type="title" style={styles.targetValue}>
                    {exercise.targetReps}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    target reps
                  </ThemedText>
                </View>
                <View style={styles.targetDivider} />
                <View style={styles.targetColumn}>
                  <ThemedText type="title" style={styles.targetValue}>
                    {exercise.targetWeight}
                    <ThemedText type="small" style={{ color: colors.accentLight }}>
                      {' '}
                      lbs
                    </ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    target weight
                  </ThemedText>
                </View>
              </View>
              {exercise.lastTime && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.lastTime}>
                  Last time: {exercise.lastTime.reps} reps @ {exercise.lastTime.weight} lbs
                </ThemedText>
              )}
            </ThemedView>
          )}

          {setPhase === 'inProgress' && (
            <ThemedView type="backgroundElement" style={styles.sliderCard}>
              <SliderRow
                label="Reps"
                value={reps}
                min={1}
                max={Math.max(exercise.targetReps * 2, 20)}
                step={1}
                onChange={setReps}
              />
              <SliderRow
                label="Weight"
                value={weight}
                min={0}
                max={Math.max(exercise.targetWeight * 2, 100)}
                step={5}
                unit="lbs"
                onChange={setWeight}
              />
            </ThemedView>
          )}

          {setPhase === 'resting' && (
            <RestTimer
              key={`${exerciseIndex}-${setIndex}`}
              seconds={REST_SECONDS}
              nextLabel={!isLastSet ? `Set ${setIndex + 2} of ${exercise.sets}` : nextExercise?.name ?? ''}
              onDone={advanceAfterRest}
            />
          )}

          {nextExercise && setPhase !== 'resting' && (
            <Pressable onPress={() => setQueueExpanded((expanded) => !expanded)}>
              <ThemedView type="backgroundElement" style={styles.nextCard}>
                <ThemedText type="smallBold" style={{ color: colors.accentLight }}>
                  NEXT
                </ThemedText>
                <ThemedText type="small" style={styles.flex}>
                  {nextExercise.name}
                </ThemedText>
                <View style={{ transform: [{ rotate: queueExpanded ? '90deg' : '-90deg' }] }}>
                  <Chevron color={colors.textSecondary} />
                </View>
              </ThemedView>
            </Pressable>
          )}

          {queueExpanded && setPhase !== 'resting' && (
            <View style={styles.queueList}>
              <SortableList
                items={queue}
                keyFor={(item) => item.id}
                rowHeight={QUEUE_ROW_HEIGHT}
                onOrderChange={reorderQueue}
                renderRow={(item) => (
                  <ThemedText type="small" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                )}
              />
            </View>
          )}
        </View>

        {setPhase !== 'resting' && (
          <Pressable
            style={styles.primaryButton}
            onPress={setPhase === 'pending' ? () => setSetPhase('inProgress') : completeSet}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              {setPhase === 'pending' ? 'Start Set' : 'Complete Set'}
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

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function SliderRow({
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
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.sliderValue}>
          {value}
          {unit ? (
            <ThemedText type="small" themeColor="textSecondary">
              {' '}
              {unit}
            </ThemedText>
          ) : null}
        </ThemedText>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.backgroundSelected}
        thumbTintColor={colors.text}
      />
    </View>
  );
}

/** Wall-clock rest countdown with a circular progress ring. */
function RestTimer({
  seconds,
  nextLabel,
  onDone,
}: {
  seconds: number;
  nextLabel: string;
  onDone: () => void;
}) {
  const endsAt = useRef<number | null>(null);
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    endsAt.current ??= Date.now() + seconds * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil(((endsAt.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(interval);
        onDone();
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size = 140;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / seconds;

  return (
    <View style={styles.restArea}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        REST
      </ThemedText>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.backgroundSelected}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </Svg>
        <View style={styles.restLabel}>
          <ThemedText type="subtitle">{formatDuration(remaining)}</ThemedText>
        </View>
      </View>
      {nextLabel ? (
        <ThemedText type="small" themeColor="textSecondary">
          Up next: {nextLabel}
        </ThemedText>
      ) : null}
      <Pressable style={styles.skipButton} onPress={onDone}>
        <ThemedText type="smallBold" style={{ color: colors.accent }}>
          Skip Rest
        </ThemedText>
      </Pressable>
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
  overviewList: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  overviewIndex: {
    width: 20,
  },
  targetCard: {
    borderRadius: Spacing.four,
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
    color: colors.accentLight,
  },
  targetDivider: {
    width: 1,
    backgroundColor: colors.backgroundSelected,
  },
  lastTime: {
    textAlign: 'center',
  },
  sliderCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.four,
    marginBottom: Spacing.three,
  },
  sliderRow: {
    gap: Spacing.one,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sliderValue: {
    fontSize: 28,
    lineHeight: 32,
  },
  restArea: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  restLabel: {
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
  nextCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  queueList: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.two,
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
  bottomBar: {
    gap: Spacing.one,
  },
  overallTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.backgroundSelected,
    overflow: 'hidden',
  },
  overallFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  bottomStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
