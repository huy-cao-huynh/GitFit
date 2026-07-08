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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Destructive, MaxContentWidth, Spacing } from '@/constants/theme';
import { makeId } from '@/lib/store/storage';
import type { Routine, RoutineExercise } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

interface DraftExercise {
  id: string;
  name: string;
  sets: number;
  targetReps: number;
  targetWeight: number;
  lastTime: RoutineExercise['lastTime'];
}

function blankExercise(): DraftExercise {
  return { id: makeId(), name: '', sets: 3, targetReps: 10, targetWeight: 0, lastTime: null };
}

export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, addRoutine, updateRoutine, deleteRoutine } = useStore();

  const isNew = id === 'new';
  const existing = isNew ? undefined : routines.find((routine) => routine.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<DraftExercise[]>(
    existing?.exercises.map((exercise) => ({ ...exercise })) ?? [blankExercise()],
  );

  const validExercises = exercises.filter((exercise) => exercise.name.trim().length > 0);
  const canSave = name.trim().length > 0 && validExercises.length > 0;

  const patchExercise = (exerciseId: string, patch: Partial<DraftExercise>) => {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    const totalSets = validExercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const routine: Routine = {
      id: existing?.id ?? makeId(),
      name: name.trim(),
      level: existing?.level ?? 'Custom',
      durationMinutes: Math.max(10, Math.round((totalSets * 3) / 5) * 5),
      tileColor: existing?.tileColor ?? 'rgba(118,120,237,0.25)',
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
                  <Stepper
                    label="Sets"
                    value={exercise.sets}
                    min={1}
                    step={1}
                    onChange={(sets) => patchExercise(exercise.id, { sets })}
                  />
                  <Stepper
                    label="Reps"
                    value={exercise.targetReps}
                    min={1}
                    step={1}
                    onChange={(targetReps) => patchExercise(exercise.id, { targetReps })}
                  />
                  <Stepper
                    label="Weight"
                    value={exercise.targetWeight}
                    min={0}
                    step={5}
                    onChange={(targetWeight) => patchExercise(exercise.id, { targetWeight })}
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

function Stepper({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.stepperControls}>
        <Pressable
          hitSlop={6}
          style={styles.stepperButton}
          onPress={() => onChange(Math.max(min, value - step))}>
          <SymbolView name="minus" size={12} tintColor={colors.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.stepperValue}>
          {value}
        </ThemedText>
        <Pressable hitSlop={6} style={styles.stepperButton} onPress={() => onChange(value + step)}>
          <SymbolView name="plus" size={12} tintColor={colors.text} />
        </Pressable>
      </View>
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
    justifyContent: 'space-between',
  },
  stepper: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 40,
    textAlign: 'center',
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
