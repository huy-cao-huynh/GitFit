import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ExerciseSetEditor } from '@/components/exercise-set-editor';
import { MuscleDiagramSheet } from '@/components/muscle-diagram-sheet';
import { ScheduleDaySelector } from '@/components/schedule-day-selector';
import { SortableList } from '@/components/sortable-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { searchExercises } from '@/lib/anatome/client';
import type { ExerciseSearchResult, MuscleLayers } from '@/lib/anatome/layers';
import { haptics } from '@/lib/haptics';
import { anatomeSlugsFor, resolveMuscleLayers } from '@/lib/muscles';
import { describeExerciseSets } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { ExerciseKind, Routine, RoutineExercise, RoutineSet, UnitSystem, Weekday } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const DEFAULT_REST_SECONDS = 60;
const EXERCISE_ROW_HEIGHT = 64;
const SEARCH_DEBOUNCE_MS = 400;

interface DraftExercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  sets: RoutineSet[];
  restSec: number;
  lastTime: RoutineExercise['lastTime'];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
}

function blankExercise(): DraftExercise {
  return { id: makeId(), name: '', kind: 'reps', sets: [], restSec: DEFAULT_REST_SECONDS, lastTime: null };
}

export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, addRoutine, updateRoutine, deleteRoutine, preferences } = useStore();
  const unitSystem = preferences.unitSystem;
  const navigation = useNavigation();

  const isNew = id === 'new';
  const existing = isNew ? undefined : routines.find((routine) => routine.id === id);

  const [name, setNameState] = useState(existing?.name ?? '');
  const [scheduledDays, setScheduledDaysState] = useState<Weekday[]>(existing?.scheduledDays ?? []);
  const [exercises, setExercisesState] = useState<DraftExercise[]>(
    existing?.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      kind: exercise.kind ?? 'reps',
      sets: exercise.sets,
      restSec: exercise.restSec ?? DEFAULT_REST_SECONDS,
      lastTime: exercise.lastTime,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
    })) ?? [],
  );
  const [editingExercise, setEditingExercise] = useState<DraftExercise | null>(null);
  const [isNewExercise, setIsNewExercise] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseResults, setExerciseResults] = useState<ExerciseSearchResult[]>([]);
  const [exerciseSearching, setExerciseSearching] = useState(false);
  const exerciseSearchAbortRef = useRef<AbortController | null>(null);

  // Debounced exercise-name search; aborts the in-flight request when the query changes.
  useEffect(() => {
    const trimmed = exerciseQuery.trim();
    const timer = setTimeout(
      async () => {
        exerciseSearchAbortRef.current?.abort();
        if (trimmed.length < 2) {
          setExerciseResults([]);
          setExerciseSearching(false);
          return;
        }
        const controller = new AbortController();
        exerciseSearchAbortRef.current = controller;
        setExerciseSearching(true);
        try {
          const found = await searchExercises(trimmed, controller.signal);
          if (!controller.signal.aborted) {
            setExerciseResults(found);
            setExerciseSearching(false);
          }
        } catch {
          if (!controller.signal.aborted) setExerciseSearching(false);
        }
      },
      trimmed.length < 2 ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [exerciseQuery]);

  // Dirty tracking is "touched at all," not deep-equality — good enough to
  // catch an accidental swipe-down after a real edit without the complexity
  // of diffing against the original. bypassPromptRef lets our own
  // Save/Discard/Delete navigate back without re-triggering the prompt.
  const dirtyRef = useRef(false);
  const bypassPromptRef = useRef(false);
  const markDirty = () => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    // Disable the interactive swipe-down-to-dismiss gesture once the form is
    // dirty, rather than only intercepting it in `beforeRemove` below — by
    // the time that listener's Alert opens, the native modal-sheet gesture
    // may already be visually mid-dismissal, so "Keep Editing" has nothing
    // left to resync. Cancel/hardware-back still go through `beforeRemove`
    // since gestureEnabled only affects the edge-swipe, not programmatic nav.
    navigation.setOptions({ gestureEnabled: false });
  };

  const setName = (value: string) => {
    setNameState(value);
    markDirty();
  };
  const setScheduledDays = (days: Weekday[]) => {
    setScheduledDaysState(days);
    markDirty();
  };
  const setExercises = (update: DraftExercise[] | ((current: DraftExercise[]) => DraftExercise[])) => {
    setExercisesState(update);
    markDirty();
  };

  const validExercises = exercises.filter((exercise) => exercise.name.trim().length > 0 && exercise.sets.length > 0);
  const canSave = name.trim().length > 0 && validExercises.length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const totalSets = validExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const routine: Routine = {
      id: existing?.id ?? makeId(),
      category: 'strength',
      name: name.trim(),
      level: existing?.level ?? 'Custom',
      durationMinutes: Math.max(10, Math.round((totalSets * 3) / 5) * 5),
      tileColor: existing?.tileColor ?? Colors.primaryTint,
      scheduledDays,
      exercises: validExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name.trim(),
        kind: exercise.kind,
        sets: exercise.sets,
        restSec: exercise.restSec,
        lastTime: exercise.lastTime,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
      })),
    };
    bypassPromptRef.current = true;
    haptics.notification(Haptics.NotificationFeedbackType.Success);
    if (existing) {
      updateRoutine(routine);
    } else {
      addRoutine(routine);
    }
    router.back();
  }, [canSave, validExercises, existing, name, scheduledDays, addRoutine, updateRoutine]);

  const handleDelete = () => {
    if (!existing) return;
    bypassPromptRef.current = true;
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    deleteRoutine(existing.id);
    router.back();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || bypassPromptRef.current) return;
      e.preventDefault();
      const discard = () => {
        bypassPromptRef.current = true;
        navigation.dispatch(e.data.action);
      };
      const buttons = canSave
        ? [
            { text: 'Keep Editing', style: 'cancel' as const },
            { text: 'Save', onPress: handleSave },
            { text: 'Discard', style: 'destructive' as const, onPress: discard },
          ]
        : [
            { text: 'Keep Editing', style: 'cancel' as const },
            { text: 'Discard', style: 'destructive' as const, onPress: discard },
          ];
      Alert.alert('Discard changes?', 'You have unsaved changes to this workout.', buttons);
    });
    return unsubscribe;
  }, [navigation, canSave, handleSave]);

  const openNewExercise = () => {
    setEditingExercise(blankExercise());
    setIsNewExercise(true);
    setExerciseQuery('');
    setExerciseResults([]);
  };

  const openEditExercise = (exercise: DraftExercise) => {
    setEditingExercise({ ...exercise, sets: exercise.sets.map((set) => ({ ...set })) });
    setIsNewExercise(false);
    setExerciseQuery('');
    setExerciseResults([]);
  };

  const closeExerciseEditor = () => setEditingExercise(null);

  const selectExerciseResult = (result: ExerciseSearchResult) => {
    haptics.selection();
    setEditingExercise((current) =>
      current
        ? {
            ...current,
            name: result.name,
            primaryMuscles: result.anatome_primary_slugs,
            secondaryMuscles: result.anatome_secondary_slugs,
          }
        : current,
    );
    setExerciseQuery('');
    setExerciseResults([]);
  };

  const canSaveExercise = !!editingExercise && editingExercise.name.trim().length > 0 && editingExercise.sets.length > 0;

  const saveExercise = () => {
    if (!editingExercise || !canSaveExercise) return;
    const name = editingExercise.name.trim();
    const fallback = editingExercise.primaryMuscles?.length ? null : anatomeSlugsFor(name);
    const saved: DraftExercise = {
      ...editingExercise,
      name,
      ...(fallback ? { primaryMuscles: fallback.primary, secondaryMuscles: fallback.secondary } : {}),
    };
    setExercises((current) =>
      isNewExercise ? [...current, saved] : current.map((exercise) => (exercise.id === saved.id ? saved : exercise)),
    );
    setEditingExercise(null);
  };

  const deleteExercise = (exerciseId: string) => {
    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
  };

  const handleDeleteExercise = () => {
    if (!editingExercise) return;
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    deleteExercise(editingExercise.id);
    setEditingExercise(null);
  };

  const reorderExercises = (orderedIds: string[]) => {
    setExercises((current) => {
      const byId = new Map(current.map((exercise) => [exercise.id, exercise]));
      const reordered = orderedIds.map((exerciseId) => byId.get(exerciseId)).filter((exercise): exercise is DraftExercise => !!exercise);
      return reordered.length === current.length ? reordered : current;
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link" style={{ color: colors.primaryLight }}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{isNew ? 'New Workout' : 'Edit Workout'}</ThemedText>
          <Pressable onPress={handleSave} hitSlop={12} disabled={!canSave}>
            <ThemedText type="link" style={{ color: colors.primaryLight, opacity: canSave ? 1 : 0.4 }}>
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

            <ThemedText type="label" style={styles.sectionLabel}>
              EXERCISES
            </ThemedText>

            {exercises.length > 0 && (
              <SortableList
                items={exercises}
                keyFor={(exercise) => exercise.id}
                rowHeight={EXERCISE_ROW_HEIGHT}
                onOrderChange={reorderExercises}
                renderRow={(exercise, dragHandle) => (
                  <ExerciseRow
                    exercise={exercise}
                    unitSystem={unitSystem}
                    onPress={() => openEditExercise(exercise)}
                    dragHandle={dragHandle}
                  />
                )}
              />
            )}

            <Pressable style={styles.addRow} onPress={openNewExercise}>
              <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
              <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
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

      <Modal
        visible={editingExercise !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeExerciseEditor}>
        {editingExercise && (
          <SafeAreaProvider>
            <ThemedView style={styles.container}>
              <SafeAreaView style={styles.safeArea}>
                <View style={styles.headerRow}>
                  <Pressable onPress={closeExerciseEditor} hitSlop={12}>
                    <ThemedText type="link" themeColor="textSecondary">
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <ThemedText type="smallBold">{isNewExercise ? 'Add Exercise' : 'Edit Exercise'}</ThemedText>
                  <Pressable onPress={saveExercise} hitSlop={12} disabled={!canSaveExercise}>
                    <ThemedText type="link" style={{ color: colors.primaryLight, opacity: canSaveExercise ? 1 : 0.4 }}>
                      Save
                    </ThemedText>
                  </Pressable>
                </View>

                <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                  <ScrollView
                    contentContainerStyle={styles.modalContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled">
                    <TextInput
                      style={styles.exerciseNameInput}
                      placeholder="Exercise name"
                      placeholderTextColor={colors.textSecondary}
                      value={editingExercise.name}
                      onChangeText={(text) => {
                        setEditingExercise((current) =>
                          current ? { ...current, name: text, primaryMuscles: undefined, secondaryMuscles: undefined } : current,
                        );
                        setExerciseQuery(text);
                      }}
                      autoFocus={isNewExercise}
                    />

                    {exerciseSearching || exerciseResults.length > 0 ? (
                      <View style={styles.searchDropdown}>
                        {exerciseSearching ? (
                          <View style={styles.searchLoadingRow}>
                            <ActivityIndicator color={colors.textSecondary} />
                          </View>
                        ) : (
                          exerciseResults.map((result) => (
                            <Pressable
                              key={result.ext_id}
                              style={styles.searchResultRow}
                              onPress={() => selectExerciseResult(result)}>
                              <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                                {result.name}
                              </ThemedText>
                            </Pressable>
                          ))
                        )}
                      </View>
                    ) : null}

                    <MusclePreview
                      layers={resolveMuscleLayers(editingExercise)}
                    />

                    <ModeToggle
                      kind={editingExercise.kind}
                      onChange={(kind) => setEditingExercise((current) => (current ? { ...current, kind } : current))}
                    />

                    <ExerciseSetEditor
                      sets={editingExercise.sets}
                      onChangeSets={(sets) =>
                        setEditingExercise((current) => (current ? { ...current, sets } : current))
                      }
                      kind={editingExercise.kind}
                      restSec={editingExercise.restSec}
                      onChangeRestSec={(restSec) =>
                        setEditingExercise((current) => (current ? { ...current, restSec } : current))
                      }
                      unitSystem={unitSystem}
                    />

                    {!isNewExercise && (
                      <Pressable style={styles.deleteButton} onPress={handleDeleteExercise}>
                        <ThemedText type="smallBold" style={styles.deleteText}>
                          Delete Exercise
                        </ThemedText>
                      </Pressable>
                    )}
                  </ScrollView>
                </KeyboardAvoidingView>
              </SafeAreaView>
            </ThemedView>
          </SafeAreaProvider>
        )}
      </Modal>
    </ThemedView>
  );
}

function ExerciseRow({
  exercise,
  unitSystem,
  onPress,
  dragHandle,
}: {
  exercise: DraftExercise;
  unitSystem: UnitSystem;
  onPress: () => void;
  dragHandle: ReactNode;
}) {
  return (
    <Pressable style={styles.exerciseRow} onPress={onPress}>
      <View style={styles.exerciseRowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {exercise.name || 'New exercise'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {describeExerciseSets(exercise, unitSystem)}
        </ThemedText>
      </View>
      <SymbolView name="pencil" size={16} tintColor={colors.textSecondary} />
      {dragHandle}
    </Pressable>
  );
}

/** Link beneath the exercise-name input to a larger diagram + chip breakdown. Renders nothing if nothing resolved yet. */
function MusclePreview({ layers }: { layers: MuscleLayers }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const slugs = [...layers.primary, ...layers.secondary];
  if (slugs.length === 0) return null;
  return (
    <View style={styles.musclePreview}>
      <Pressable hitSlop={6} onPress={() => setSheetOpen(true)}>
        <ThemedText type="small" style={{ color: colors.primaryLight }}>
          View muscle groups
        </ThemedText>
      </Pressable>
      <MuscleDiagramSheet
        visible={sheetOpen}
        primary={layers.primary}
        secondary={layers.secondary}
        onClose={() => setSheetOpen(false)}
      />
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  exerciseRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  exerciseRowText: {
    flex: 1,
    gap: Spacing.half,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  deleteButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: Spacing.three,
  },
  deleteText: {
    color: colors.danger,
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
  exerciseNameInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  modalContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  searchDropdown: {
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  searchLoadingRow: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  musclePreview: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
});
