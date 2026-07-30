import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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

import { IconButton } from '@/components/icon-button';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { METRIC_ICONS } from '@/lib/metric-icons';
import {
  CALENDAR_WEEKDAY_OPTIONS,
  calendarWeekDays,
  estimateRoutineCalories,
  scheduledRoutineTasks,
  todayKey,
  unscheduledCompletedWorkouts,
  weekdayForDate,
} from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { GoalDef, GoalMetric } from '@/lib/store/types';
import { useResetScrollOnFocus } from '@/lib/use-reset-scroll-on-focus';
import { formatWeight, fromDisplayVolume, fromDisplayWeight, toDisplayVolume, volumeUnitLabel, weightUnitLabel } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

function selectedDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Stepper behavior per metric; water values are in display units. */
const METRIC_META: Record<GoalMetric, { min: number; max: number; step: number }> = {
  workouts: { min: 1, max: 14, step: 1 },
  calories: { min: 100, max: 5000, step: 50 },
  cardio: { min: 0, max: 420, step: 5 },
  water: { min: 0, max: 1000, step: 8 },
  steps: { min: 7000, max: 140000, step: 1000 },
  bodyweight: { min: 1, max: 7, step: 1 },
  manual: { min: 1, max: 100, step: 1 },
};

interface GoalPreset {
  metric: Exclude<GoalMetric, 'manual'>;
  label: string;
  target: number;
  unit: string;
}

/** The built-in goals, offered as one-tap re-adds when missing. */
const BUILTIN_GOAL_PRESETS: GoalPreset[] = [
  { metric: 'workouts', label: 'Workouts', target: 5, unit: 'workouts' },
  { metric: 'calories', label: 'Calories Burned', target: 1500, unit: 'cal' },
  { metric: 'cardio', label: 'Cardio', target: 60, unit: 'min' },
  { metric: 'water', label: 'Water', target: 448, unit: 'oz' },
  { metric: 'steps', label: 'Steps', target: 70000, unit: 'steps' },
  { metric: 'bodyweight', label: 'Weigh In', target: 1, unit: 'weigh-ins' },
];

export default function LoggingScreen() {
  const {
    routines,
    sessions,
    cardioSessions,
    goals,
    setGoals,
    checkoffDefs,
    setCheckoffDefs,
    checkoffLog,
    toggleCheckoff,
    bodyweight,
    addBodyweight,
    preferences,
  } = useStore();

  const unitSystem = preferences.unitSystem;
  const scrollRef = useResetScrollOnFocus<ScrollView>();
  const today = todayKey();
  const doneToday = checkoffLog[today] ?? [];
  const [selectedDate, setSelectedDate] = useState(today);

  const [newCheckoff, setNewCheckoff] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalValue, setEditingGoalValue] = useState('');
  const [renamingGoalId, setRenamingGoalId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const selectedDateObject = selectedDateFromKey(selectedDate);
  const selectedDateLabel = selectedDateObject.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const calendarDays = calendarWeekDays(routines, sessions, cardioSessions, selectedDateObject);
  const selectedTasks = scheduledRoutineTasks(routines, sessions, cardioSessions, selectedDate);
  const extraCompletedWorkouts = unscheduledCompletedWorkouts(routines, sessions, cardioSessions, selectedDate);
  const visibleGoals = goals.filter(
    (goal): goal is GoalDef & { metric: Exclude<GoalMetric, 'manual'> } => goal.metric !== 'manual',
  );
  const missingPresets = BUILTIN_GOAL_PRESETS.filter(
    (preset) => !goals.some((goal) => goal.metric === preset.metric),
  );

  const addCheckoff = () => {
    const name = newCheckoff.trim();
    if (!name) return;
    setCheckoffDefs([...checkoffDefs, { id: makeId(), name }]);
    setNewCheckoff('');
  };

  const displayTargetFor = (goal: GoalDef) =>
    goal.metric === 'water' ? toDisplayVolume(goal.target, unitSystem) : goal.target;

  const setGoalTarget = (goal: GoalDef, displayValue: number) => {
    const meta = METRIC_META[goal.metric];
    const clamped = Math.min(meta.max, Math.max(meta.min, displayValue));
    const target = goal.metric === 'water' ? fromDisplayVolume(clamped, unitSystem) : clamped;
    setGoals(goals.map((existing) => (existing.id === goal.id ? { ...existing, target } : existing)));
  };

  const startEditingTarget = (goal: GoalDef) => {
    setEditingGoalId(goal.id);
    setEditingGoalValue(String(displayTargetFor(goal)));
  };

  const commitEditingTarget = (goal: GoalDef) => {
    const value = Number(editingGoalValue);
    if (Number.isFinite(value) && value > 0) {
      setGoalTarget(goal, value);
    }
    setEditingGoalId(null);
  };

  const startRenaming = (goal: GoalDef) => {
    setRenamingGoalId(goal.id);
    setRenameValue(goal.label);
  };

  const commitRename = (goal: GoalDef) => {
    const label = renameValue.trim();
    if (label) {
      setGoals(goals.map((existing) => (existing.id === goal.id ? { ...existing, label } : existing)));
    }
    setRenamingGoalId(null);
  };

  const addPresetGoal = (preset: GoalPreset) => {
    setGoals([...goals, { id: makeId(), ...preset }]);
  };

  const weighInGoal = goals.find((goal) => goal.metric === 'bodyweight');
  const showWeighInTask = !!weighInGoal && weekdayForDate(selectedDateObject) === weighInGoal.target;
  const weightForSelectedDate = bodyweight.find((entry) => entry.date === selectedDate);

  const saveWeight = () => {
    const displayValue = Number(weightInput);
    if (!Number.isFinite(displayValue) || displayValue <= 0) return;
    addBodyweight({ date: selectedDate, weight: fromDisplayWeight(displayValue, unitSystem) });
    setWeightInput('');
  };

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.scrollWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} style={styles.scrollWrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Goals</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Track your daily goals and progress.
              </ThemedText>
            </View>

            <ThemedText type="label" style={styles.sectionLabel}>
              CALENDAR
            </ThemedText>
            <ThemedView type="surface" style={styles.calendarCard}>
              <View style={styles.calendarRow}>
                {calendarDays.map((day) => {
                  const selected = day.date === selectedDate;
                  const complete = day.completedCount > 0 && day.completedCount >= day.scheduledCount;
                  // Past days all read the same regardless of what happened —
                  // the green dot is the only signal of a completed workout.
                  const isPast = !day.isToday && day.date < today;
                  const isFuture = !day.isToday && !isPast;
                  return (
                    <Pressable key={day.date} style={styles.calendarDay} onPress={() => setSelectedDate(day.date)}>
                      <View
                        style={[
                          styles.calendarCell,
                          isPast && styles.calendarCellPast,
                          isFuture && styles.calendarCellFuture,
                          day.isToday && styles.calendarCellToday,
                          selected && styles.calendarCellSelected,
                        ]}>
                        <ThemedText
                          type="statInline"
                          style={[day.isToday && styles.calendarNumberToday, isPast && styles.calendarNumberPast]}>
                          {day.dayNumber}
                        </ThemedText>
                        <ThemedText
                          type="caption"
                          themeColor={day.isToday ? 'onPrimaryDim' : isPast ? 'textMuted' : 'textSecondary'}>
                          {day.label}
                        </ThemedText>
                        <View
                          style={[
                            styles.completedDot,
                            day.isToday && styles.completedDotOnToday,
                            !complete && styles.completedDotHidden,
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.selectedDayHeader}>
                <ThemedText type="smallBold">{selectedDateLabel}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {selectedTasks.length} scheduled
                  {extraCompletedWorkouts.length > 0 ? ` · ${extraCompletedWorkouts.length} extra` : ''}
                </ThemedText>
              </View>

              {selectedTasks.length === 0 && extraCompletedWorkouts.length === 0 && !showWeighInTask ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No workouts scheduled for this day.
                </ThemedText>
              ) : (
                <View style={styles.workoutPreviewCard}>
                  {selectedTasks.map((task) => {
                    const incomplete = !task.completed && selectedDate < today;
                    const statusLabel = task.completed ? 'Completed' : incomplete ? 'Incomplete' : 'TODO';
                    // TODO and Incomplete both mean "not done yet" — only timing
                    // differs — so they share the same orange treatment.
                    const statusStyle = task.completed ? styles.statusPillCompleted : styles.statusPillIncomplete;
                    const statusTextColor = task.completed ? colors.primaryLight : colors.warning;
                    const path =
                      task.routine.category === 'cardio'
                        ? { pathname: '/cardio/[id]' as const, params: { id: task.routine.id } }
                        : { pathname: '/workout/[id]' as const, params: { id: task.routine.id } };
                    return (
                      <Pressable
                        key={task.routine.id}
                        style={styles.scheduledRow}
                        onPress={() => router.push(path)}
                        disabled={task.completed}>
                        <View style={styles.flex}>
                          <ThemedText type="smallBold">{task.routine.name}</ThemedText>
                          <View style={styles.workoutMetaRow}>
                            <View style={[styles.statusPill, statusStyle]}>
                              <ThemedText type="caption" style={{ color: statusTextColor }}>
                                {statusLabel}
                              </ThemedText>
                            </View>
                            {task.routine.category !== 'cardio' && (
                              <>
                                <View style={styles.metaItem}>
                                  <SymbolView name="timer" size={11} tintColor={colors.textSecondary} />
                                  <ThemedText type="small" themeColor="textSecondary">
                                    {task.routine.durationMinutes} min
                                  </ThemedText>
                                </View>
                                <View style={styles.metaItem}>
                                  <SymbolView name="flame.fill" size={11} tintColor={colors.textSecondary} />
                                  <ThemedText type="small" themeColor="textSecondary">
                                    ~{estimateRoutineCalories(task.routine)} cal
                                  </ThemedText>
                                </View>
                              </>
                            )}
                          </View>
                        </View>
                        {!task.completed && <SymbolView name="chevron.right" size={12} tintColor={colors.textSecondary} />}
                      </Pressable>
                    );
                  })}
                  {extraCompletedWorkouts.map((workout) => {
                    const historyPath =
                      workout.category === 'cardio'
                        ? { pathname: '/history/cardio/[id]' as const, params: { id: workout.id } }
                        : { pathname: '/history/[id]' as const, params: { id: workout.id } };
                    return (
                      <Pressable
                        key={workout.id}
                        style={styles.scheduledRow}
                        onPress={() => router.push(historyPath)}>
                        <View style={styles.flex}>
                          <ThemedText type="smallBold">{workout.name}</ThemedText>
                          <View style={styles.workoutMetaRow}>
                            <View style={[styles.statusPill, styles.statusPillCompleted]}>
                              <ThemedText type="caption" style={{ color: colors.primaryLight }}>
                                Completed
                              </ThemedText>
                            </View>
                            <View style={styles.metaItem}>
                              <SymbolView name="timer" size={11} tintColor={colors.textSecondary} />
                              <ThemedText type="small" themeColor="textSecondary">
                                {workout.minutes} min
                              </ThemedText>
                            </View>
                            <View style={styles.metaItem}>
                              <SymbolView name="flame.fill" size={11} tintColor={colors.textSecondary} />
                              <ThemedText type="small" themeColor="textSecondary">
                                {workout.calories} cal
                              </ThemedText>
                            </View>
                          </View>
                        </View>
                        <SymbolView name="chevron.right" size={12} tintColor={colors.textSecondary} />
                      </Pressable>
                    );
                  })}
                  {showWeighInTask &&
                    (() => {
                      const weighInCompleted = !!weightForSelectedDate;
                      const weighInIncomplete = !weighInCompleted && selectedDate < today;
                      // Same TODO/Completed/Incomplete convention as scheduled routine tasks above.
                      const weighInStatusLabel = weighInCompleted ? 'Completed' : weighInIncomplete ? 'Incomplete' : 'TODO';
                      const weighInStatusStyle = weighInCompleted ? styles.statusPillCompleted : styles.statusPillIncomplete;
                      const weighInStatusTextColor = weighInCompleted ? colors.primaryLight : colors.warning;
                      return (
                        <View style={styles.scheduledRow}>
                          <View style={styles.flex}>
                            <ThemedText type="smallBold">Weigh In</ThemedText>
                            <View style={styles.workoutMetaRow}>
                              <View style={[styles.statusPill, weighInStatusStyle]}>
                                <ThemedText type="caption" style={{ color: weighInStatusTextColor }}>
                                  {weighInStatusLabel}
                                </ThemedText>
                              </View>
                              {weightForSelectedDate && (
                                <ThemedText type="small" themeColor="textSecondary">
                                  {formatWeight(weightForSelectedDate.weight, unitSystem)}
                                </ThemedText>
                              )}
                            </View>
                            {!weighInCompleted && (
                              <View style={[styles.inputRow, styles.weighInInputRow]}>
                                <TextInput
                                  style={[styles.textInput, styles.flex]}
                                  placeholder={`Log weight (${weightUnitLabel(unitSystem)})`}
                                  placeholderTextColor={colors.textSecondary}
                                  value={weightInput}
                                  onChangeText={setWeightInput}
                                  keyboardType="decimal-pad"
                                  onSubmitEditing={saveWeight}
                                  returnKeyType="done"
                                />
                                <IconButton
                                  icon="checkmark.circle.fill"
                                  active={!!weightInput.trim()}
                                  onPress={saveWeight}
                                />
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })()}
                </View>
              )}
            </ThemedView>

            <ThemedText type="label" style={styles.sectionLabel}>
              WEEKLY GOALS
            </ThemedText>
            <ThemedView type="surface" style={styles.card}>
              {visibleGoals.map((goal, index) => {
                if (goal.metric === 'bodyweight') {
                  return (
                    <View key={goal.id} style={[styles.goalRowColumn, index > 0 && styles.rowDivider]}>
                      <View style={styles.goalRowTop}>
                        <View style={styles.goalIcon}>
                          <SymbolView name={METRIC_ICONS.bodyweight} size={14} tintColor={colors.primaryLight} />
                        </View>
                        <View style={styles.goalLabelWrap}>
                          {renamingGoalId === goal.id ? (
                            <TextInput
                              style={styles.goalLabelInput}
                              value={renameValue}
                              onChangeText={setRenameValue}
                              onSubmitEditing={() => commitRename(goal)}
                              onBlur={() => commitRename(goal)}
                              autoFocus
                              selectTextOnFocus
                              returnKeyType="done"
                            />
                          ) : (
                            <Pressable hitSlop={4} onPress={() => startRenaming(goal)}>
                              <ThemedText type="small" numberOfLines={1}>
                                {goal.label}
                              </ThemedText>
                            </Pressable>
                          )}
                        </View>
                        <Pressable
                          hitSlop={8}
                          onPress={() => setGoals(goals.filter((existing) => existing.id !== goal.id))}>
                          <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
                        </Pressable>
                      </View>
                      <View style={styles.weekdayChipRow}>
                        {CALENDAR_WEEKDAY_OPTIONS.map((day) => {
                          const active = goal.target === day.value;
                          return (
                            <Pressable
                              key={day.value}
                              style={[styles.weekdayChip, active && styles.weekdayChipActive]}
                              onPress={() =>
                                setGoals(
                                  goals.map((existing) =>
                                    existing.id === goal.id ? { ...existing, target: day.value } : existing,
                                  ),
                                )
                              }>
                              <ThemedText type="caption" themeColor={active ? 'onPrimary' : 'textSecondary'}>
                                {day.short}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                }

                const displayTarget = displayTargetFor(goal);
                const unitLabel =
                  goal.metric === 'water' ? volumeUnitLabel(unitSystem) : goal.unit || '/ week';
                return (
                  <View key={goal.id} style={[styles.goalRow, index > 0 && styles.rowDivider]}>
                    <View style={styles.goalIcon}>
                      <SymbolView name={METRIC_ICONS[goal.metric]} size={14} tintColor={colors.primaryLight} />
                    </View>
                    <View style={styles.goalLabelWrap}>
                      {renamingGoalId === goal.id ? (
                        <TextInput
                          style={styles.goalLabelInput}
                          value={renameValue}
                          onChangeText={setRenameValue}
                          onSubmitEditing={() => commitRename(goal)}
                          onBlur={() => commitRename(goal)}
                          autoFocus
                          selectTextOnFocus
                          returnKeyType="done"
                        />
                      ) : (
                        <Pressable hitSlop={4} onPress={() => startRenaming(goal)}>
                          <ThemedText type="small" numberOfLines={1}>
                            {goal.label}
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.goalControls}>
                      <View style={styles.stepperPill}>
                        <Pressable
                          hitSlop={6}
                          onPress={() => setGoalTarget(goal, displayTarget - METRIC_META[goal.metric].step)}>
                          <SymbolView name="minus" size={12} tintColor={colors.primaryLight} />
                        </Pressable>
                        {editingGoalId === goal.id ? (
                          <TextInput
                            style={styles.goalValueInput}
                            keyboardType="number-pad"
                            value={editingGoalValue}
                            onChangeText={setEditingGoalValue}
                            onSubmitEditing={() => commitEditingTarget(goal)}
                            onBlur={() => commitEditingTarget(goal)}
                            autoFocus
                            selectTextOnFocus
                            returnKeyType="done"
                          />
                        ) : (
                          <Pressable hitSlop={6} onPress={() => startEditingTarget(goal)}>
                            <ThemedText type="smallBold" style={styles.goalValue}>
                              {displayTarget}
                              <ThemedText type="small" themeColor="textSecondary">
                                {' '}
                                {unitLabel}
                              </ThemedText>
                            </ThemedText>
                          </Pressable>
                        )}
                        <Pressable
                          hitSlop={6}
                          onPress={() => setGoalTarget(goal, displayTarget + METRIC_META[goal.metric].step)}>
                          <SymbolView name="plus" size={12} tintColor={colors.primaryLight} />
                        </Pressable>
                      </View>
                      <Pressable
                        hitSlop={8}
                        onPress={() => setGoals(goals.filter((existing) => existing.id !== goal.id))}>
                        <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {missingPresets.length > 0 && (
                <View style={[styles.suggestionRow, visibleGoals.length > 0 && styles.rowDivider]}>
                  {missingPresets.map((preset) => (
                    <Pressable key={preset.metric} style={styles.suggestionChip} onPress={() => addPresetGoal(preset)}>
                      <SymbolView name="plus" size={10} tintColor={colors.primaryLight} />
                      <ThemedText type="small" style={{ color: colors.primaryLight }}>
                        {preset.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </ThemedView>

            <ThemedText type="label" style={styles.sectionLabel}>
              DAILY GOALS
            </ThemedText>
            <ThemedView type="surface" style={styles.card}>
              {checkoffDefs.map((def, index) => {
                const done = doneToday.includes(def.id);
                return (
                  <Pressable
                    key={def.id}
                    style={[styles.checkoffRow, index > 0 && styles.rowDivider]}
                    onPress={() => toggleCheckoff(today, def.id)}>
                    <View
                      style={[
                        styles.checkCircle,
                        done ? { backgroundColor: colors.primary } : { borderWidth: 2, borderColor: colors.border },
                      ]}>
                      {done && <SymbolView name="checkmark" size={12} tintColor={colors.onPrimary} />}
                    </View>
                    <ThemedText type="small" style={styles.flex}>
                      {def.name}
                    </ThemedText>
                    <Pressable
                      hitSlop={8}
                      onPress={() => setCheckoffDefs(checkoffDefs.filter((existing) => existing.id !== def.id))}>
                      <SymbolView name="xmark.circle.fill" size={20} tintColor={colors.textSecondary} />
                    </Pressable>
                  </Pressable>
                );
              })}
              <View style={[styles.inputRow, checkoffDefs.length > 0 && styles.rowDivider]}>
                <TextInput
                  style={[styles.textInput, styles.flex]}
                  placeholder="Add a daily goal"
                  placeholderTextColor={colors.textSecondary}
                  value={newCheckoff}
                  onChangeText={setNewCheckoff}
                  onSubmitEditing={addCheckoff}
                  returnKeyType="done"
                />
                <IconButton icon="plus.circle.fill" active={!!newCheckoff.trim()} onPress={addCheckoff} />
              </View>
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  // Explicit width (not just flex: 1) matters here — `safeArea` below uses `alignItems: 'center'`,
  // so without it this sizes to its own content instead of the viewport, and any row that's
  // naturally wider than the screen silently pushes the whole page wider than the phone.
  scrollWrap: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
  },
  calendarCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDay: {
    alignItems: 'center',
  },
  calendarCell: {
    width: 44,
    minHeight: 60,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  calendarCellFuture: {
    backgroundColor: colors.surfaceElevated,
  },
  calendarCellSelected: {
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  calendarCellToday: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  calendarCellPast: {
    backgroundColor: colors.surfaceElevated,
  },
  calendarNumberToday: {
    color: colors.onPrimary,
  },
  calendarNumberPast: {
    color: colors.textMuted,
  },
  completedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  completedDotOnToday: {
    backgroundColor: colors.onPrimary,
  },
  completedDotHidden: {
    opacity: 0,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutPreviewCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  workoutMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  statusPill: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  statusPillCompleted: {
    backgroundColor: colors.primaryTint,
  },
  statusPillIncomplete: {
    backgroundColor: 'rgba(245,165,36,0.14)',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  goalRowColumn: {
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  goalRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  weekdayChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  weekdayChip: {
    flex: 1,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  weekdayChipActive: {
    backgroundColor: colors.primary,
  },
  weighInInputRow: {
    paddingVertical: 0,
    marginTop: Spacing.two,
  },
  goalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalLabelWrap: {
    flex: 1,
    gap: Spacing.half,
  },
  goalLabelInput: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    fontSize: 14,
  },
  goalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalValue: {
    minWidth: 64,
    textAlign: 'center',
  },
  goalValueInput: {
    minWidth: 64,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    fontSize: 14,
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    backgroundColor: colors.primaryTint,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  textInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 14,
  },
});
