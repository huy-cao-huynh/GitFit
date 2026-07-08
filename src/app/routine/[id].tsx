import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ScheduleDaySelector } from '@/components/schedule-day-selector';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Destructive, MaxContentWidth, Spacing } from '@/constants/theme';
import { makeId } from '@/lib/store/id';
import type { ExerciseKind, Routine, RoutineExercise, Weekday } from '@/lib/store/types';
import { fromDisplayWeight, toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

interface DraftExercise {
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
  lastTime: RoutineExercise['lastTime'];
}

const DEFAULT_REST_SECONDS = 30;

function blankExercise(): DraftExercise {
  return {
    id: makeId(),
    name: '',
    kind: 'reps',
    warmupSets: 0,
    warmupTargetReps: 8,
    warmupTargetWeight: 0,
    warmupTargetDurationSec: 30,
    warmupRestSec: DEFAULT_REST_SECONDS,
    sets: 3,
    targetReps: 10,
    targetWeight: 0,
    targetDurationSec: 45,
    targetRestSec: DEFAULT_REST_SECONDS,
    lastTime: null,
  };
}

export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, addRoutine, updateRoutine, deleteRoutine, preferences } = useStore();
  const unitSystem = preferences.unitSystem;

  const isNew = id === 'new';
  const existing = isNew ? undefined : routines.find((routine) => routine.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [scheduledDays, setScheduledDays] = useState<Weekday[]>(existing?.scheduledDays ?? []);
  const [exercises, setExercises] = useState<DraftExercise[]>(
    existing?.exercises.map((exercise) => ({
      ...exercise,
      kind: exercise.kind ?? 'reps',
      warmupSets: exercise.warmupSets ?? 0,
      warmupTargetReps: exercise.warmupTargetReps ?? exercise.targetReps,
      warmupTargetWeight: exercise.warmupTargetWeight ?? 0,
      warmupTargetDurationSec: exercise.warmupTargetDurationSec ?? exercise.targetDurationSec ?? 30,
      warmupRestSec: exercise.warmupRestSec ?? exercise.targetRestSec ?? DEFAULT_REST_SECONDS,
      targetDurationSec: exercise.targetDurationSec ?? 45,
      targetRestSec: exercise.targetRestSec ?? DEFAULT_REST_SECONDS,
    })) ?? [blankExercise()],
  );

  const validExercises = exercises.filter((exercise) => exercise.name.trim().length > 0);
  const canSave = name.trim().length > 0 && validExercises.length > 0;

  const patchExercise = (exerciseId: string, patch: Partial<DraftExercise>) => {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    );
  };

  const addWarmupSet = (exercise: DraftExercise) => {
    patchExercise(exercise.id, {
      warmupSets: exercise.sets,
      warmupTargetReps: exercise.targetReps,
      warmupTargetWeight: exercise.targetWeight,
      warmupTargetDurationSec: exercise.targetDurationSec,
      warmupRestSec: exercise.targetRestSec,
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    const totalSets = validExercises.reduce((sum, exercise) => sum + exercise.warmupSets + exercise.sets, 0);
    const routine: Routine = {
      id: existing?.id ?? makeId(),
      category: 'strength',
      name: name.trim(),
      level: existing?.level ?? 'Custom',
      durationMinutes: Math.max(10, Math.round((totalSets * 3) / 5) * 5),
      tileColor: existing?.tileColor ?? 'rgba(118,120,237,0.25)',
      scheduledDays,
      exercises: validExercises.map((exercise) => ({ ...exercise, name: exercise.name.trim() })),
    };
    if (existing) {
      updateRoutine(routine);
    } else {
      addRoutine(routine);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    deleteRoutine(existing.id);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link" style={{ color: colors.accent }}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{isNew ? 'New Workout' : 'Edit Workout'}</ThemedText>
          <Pressable onPress={handleSave} hitSlop={12} disabled={!canSave}>
            <ThemedText type="link" style={{ color: colors.accent, opacity: canSave ? 1 : 0.4 }}>
              Save
            </ThemedText>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <TextInput
              style={styles.nameInput}
              placeholder="Workout name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <ScheduleDaySelector selectedDays={scheduledDays} onChange={setScheduledDays} />

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              EXERCISES
            </ThemedText>

            {exercises.map((exercise) => (
              <ThemedView key={exercise.id} type="backgroundElement" style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <TextInput
                    style={styles.exerciseNameInput}
                    placeholder="Exercise name"
                    placeholderTextColor={colors.textSecondary}
                    value={exercise.name}
                    onChangeText={(text) => patchExercise(exercise.id, { name: text })}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setExercises((current) => current.filter((e) => e.id !== exercise.id))
                    }>
                    <SymbolView name="xmark.circle.fill" size={20} tintColor={colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.stepperRow}>
                  <ModeToggle
                    kind={exercise.kind}
                    onChange={(kind) => patchExercise(exercise.id, { kind })}
                  />
                  {exercise.warmupSets === 0 ? (
                    <View style={styles.setActionsRow}>
                      <Pressable style={styles.addWarmupButton} onPress={() => addWarmupSet(exercise)}>
                        <SymbolView name="plus.circle.fill" size={16} tintColor={colors.accent} />
                        <ThemedText type="smallBold" style={{ color: colors.accent }}>
                          Warm-up
                        </ThemedText>
                      </Pressable>
                    </View>
                  ) : null}
                  {exercise.warmupSets > 0 ? (
                    <View style={styles.warmupGroup}>
                      <View style={styles.warmupHeader}>
                        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.warmupTitle}>
                          WARM-UP SETS
                        </ThemedText>
                        <Pressable
                          hitSlop={8}
                          style={styles.warmupRemoveButton}
                          onPress={() => patchExercise(exercise.id, { warmupSets: 0 })}>
                          <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
                        </Pressable>
                      </View>
                      <Stepper
                        label="Sets"
                        value={exercise.warmupSets}
                        min={1}
                        step={1}
                        onChange={(warmupSets) => patchExercise(exercise.id, { warmupSets })}
                      />
                      {exercise.kind === 'time' ? (
                        <Stepper
                          label="Time"
                          value={exercise.warmupTargetDurationSec}
                          min={5}
                          step={5}
                          suffix="sec"
                          onChange={(warmupTargetDurationSec) => patchExercise(exercise.id, { warmupTargetDurationSec })}
                        />
                      ) : (
                        <>
                          <Stepper
                            label="Reps"
                            value={exercise.warmupTargetReps}
                            min={1}
                            step={1}
                            onChange={(warmupTargetReps) => patchExercise(exercise.id, { warmupTargetReps })}
                          />
                          <Stepper
                            label="Weight"
                            value={toDisplayWeight(exercise.warmupTargetWeight, unitSystem)}
                            min={0}
                            step={unitSystem === 'metric' ? 1 : 2.5}
                            suffix={weightUnitLabel(unitSystem)}
                            onChange={(displayWeight) =>
                              patchExercise(exercise.id, { warmupTargetWeight: fromDisplayWeight(displayWeight, unitSystem) })
                            }
                          />
                        </>
                      )}
                      <Stepper
                        label="Rest"
                        value={exercise.warmupRestSec}
                        min={0}
                        step={5}
                        suffix="sec"
                        onChange={(warmupRestSec) => patchExercise(exercise.id, { warmupRestSec })}
                      />
                    </View>
                  ) : null}
                  <Stepper
                    label="Sets"
                    value={exercise.sets}
                    min={1}
                    step={1}
                    onChange={(sets) => patchExercise(exercise.id, { sets })}
                  />
                  {exercise.kind === 'time' ? (
                    <Stepper
                      label="Time"
                      value={exercise.targetDurationSec}
                      min={5}
                      step={5}
                      suffix="sec"
                      onChange={(targetDurationSec) => patchExercise(exercise.id, { targetDurationSec })}
                    />
                  ) : (
                    <>
                      <Stepper
                        label="Reps"
                        value={exercise.targetReps}
                        min={1}
                        step={1}
                        onChange={(targetReps) => patchExercise(exercise.id, { targetReps })}
                      />
                      <Stepper
                        label="Weight"
                        value={toDisplayWeight(exercise.targetWeight, unitSystem)}
                        min={0}
                        step={unitSystem === 'metric' ? 1 : 2.5}
                        suffix={weightUnitLabel(unitSystem)}
                        onChange={(displayWeight) =>
                          patchExercise(exercise.id, { targetWeight: fromDisplayWeight(displayWeight, unitSystem) })
                        }
                      />
                    </>
                  )}
                  <Stepper
                    label="Rest"
                    value={exercise.targetRestSec}
                    min={0}
                    step={5}
                    suffix="sec"
                    onChange={(targetRestSec) => patchExercise(exercise.id, { targetRestSec })}
                  />
                </View>
              </ThemedView>
            ))}

            <Pressable
              style={styles.addRow}
              onPress={() => setExercises((current) => [...current, blankExercise()])}>
              <SymbolView name="plus.circle.fill" size={20} tintColor={colors.accent} />
              <ThemedText type="smallBold" style={{ color: colors.accent }}>
                Add Exercise
              </ThemedText>
            </Pressable>

            {existing && (
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <ThemedText type="smallBold" style={styles.deleteText}>
                  Delete Workout
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
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
    paddingTop: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  nameInput: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.backgroundElement,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  exerciseCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  exerciseNameInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: Spacing.one,
  },
  stepperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  setActionsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  addWarmupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: colors.backgroundSelected,
  },
  warmupGroup: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    backgroundColor: colors.backgroundSelected,
  },
  warmupHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  warmupTitle: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  warmupRemoveButton: {
    position: 'absolute',
    right: 0,
  },
  modeToggle: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: Spacing.three,
    backgroundColor: colors.backgroundSelected,
    padding: Spacing.half,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modeButtonActive: {
    backgroundColor: colors.accent,
  },
  modeTextActive: {
    color: colors.background,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  deleteButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Destructive,
    marginTop: Spacing.three,
  },
  deleteText: {
    color: Destructive,
  },
});
