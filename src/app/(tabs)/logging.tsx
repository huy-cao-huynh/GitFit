import * as Haptics from 'expo-haptics';
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
import {
  calendarWeekDays,
  currentGoalValue,
  scheduledRoutineTasks,
  todayKey,
  todayWaterOunces,
  unscheduledCompletedWorkouts,
} from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { GoalDef, GoalMetric } from '@/lib/store/types';
import {
  formatVolume,
  fromDisplayVolume,
  toDisplayVolume,
  volumeUnitLabel,
} from '@/lib/units';
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
  manual: { min: 1, max: 100, step: 1 },
};

const METRIC_ICONS = {
  workouts: 'dumbbell.fill',
  calories: 'flame.fill',
  cardio: 'figure.run',
  water: 'drop.fill',
} as const;

interface GoalPreset {
  metric: Exclude<GoalMetric, 'manual'>;
  label: string;
  target: number;
  unit: string;
}

/** The old built-in goals, offered as one-tap re-adds when missing. */
const BUILTIN_GOAL_PRESETS: GoalPreset[] = [
  { metric: 'workouts', label: 'Workouts', target: 5, unit: 'workouts' },
  { metric: 'calories', label: 'Calories', target: 1500, unit: 'cal' },
  { metric: 'cardio', label: 'Cardio', target: 60, unit: 'min' },
  { metric: 'water', label: 'Water', target: 448, unit: 'oz' },
];

const DEFAULT_CUSTOM_TARGET = 7;
const WATER_QUICK_ADD_IMPERIAL = 16;
const WATER_QUICK_ADD_METRIC = 500;

export default function LoggingScreen() {
  const {
    routines,
    sessions,
    cardioSessions,
    goals,
    setGoals,
    goalEntries,
    addGoalEntry,
    checkoffDefs,
    setCheckoffDefs,
    checkoffLog,
    toggleCheckoff,
    waterEntries,
    addWaterEntry,
    preferences,
  } = useStore();

  const unitSystem = preferences.unitSystem;
  const today = todayKey();
  const doneToday = checkoffLog[today] ?? [];
  const [selectedDate, setSelectedDate] = useState(today);

  const waterGoal = goals.find((goal) => goal.metric === 'water');
  const todayWater = todayWaterOunces(waterEntries);

  const [newCheckoff, setNewCheckoff] = useState('');
  const [newGoalLabel, setNewGoalLabel] = useState('');
  const [newGoalUnit, setNewGoalUnit] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalValue, setEditingGoalValue] = useState('');
  const [renamingGoalId, setRenamingGoalId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [customWater, setCustomWater] = useState('');
  const selectedDateObject = selectedDateFromKey(selectedDate);
  const selectedDateLabel = selectedDateObject.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const calendarDays = calendarWeekDays(routines, sessions, cardioSessions, selectedDateObject);
  const selectedTasks = scheduledRoutineTasks(routines, sessions, cardioSessions, selectedDate);
  const extraCompletedWorkouts = unscheduledCompletedWorkouts(routines, sessions, cardioSessions, selectedDate);
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

  const addCustomGoal = () => {
    const label = newGoalLabel.trim();
    if (!label) return;
    setGoals([
      ...goals,
      { id: makeId(), metric: 'manual', label, target: DEFAULT_CUSTOM_TARGET, unit: newGoalUnit.trim() },
    ]);
    setNewGoalLabel('');
    setNewGoalUnit('');
  };

  const addPresetGoal = (preset: GoalPreset) => {
    setGoals([...goals, { id: makeId(), ...preset }]);
  };

  const checkInGoal = (goal: GoalDef) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addGoalEntry({ id: makeId(), goalId: goal.id, date: today, amount: 1 });
  };

  const addWater = (displayAmount: number) => {
    let deltaOunces = Math.round(fromDisplayVolume(displayAmount, unitSystem));
    if (deltaOunces < 0) deltaOunces = Math.max(deltaOunces, -todayWater);
    if (deltaOunces === 0) return;
    addWaterEntry({ id: makeId(), date: today, ounces: deltaOunces });
  };

  const addCustomWater = (sign: 1 | -1) => {
    const value = Number(customWater);
    if (!Number.isFinite(value) || value <= 0) return;
    addWater(sign * value);
    setCustomWater('');
  };

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.scrollWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scrollWrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Goals & Logging</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Track your daily goals and progress.
              </ThemedText>
            </View>

            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
              CALENDAR
            </ThemedText>
            <ThemedView type="surface" style={styles.calendarCard}>
              <View style={styles.calendarRow}>
                {calendarDays.map((day) => {
                  const selected = day.date === selectedDate;
                  const complete = day.completedCount > 0 && day.completedCount >= day.scheduledCount;
                  const todo = day.scheduledCount > 0 && !complete;
                  const missed = todo && day.date < today;
                  return (
                    <Pressable key={day.date} style={styles.calendarDay} onPress={() => setSelectedDate(day.date)}>
                      <View style={styles.weekdayMarkerSlot}>
                        <View style={[styles.todayMarker, !day.isToday && styles.todayMarkerHidden]} />
                        <ThemedText type="small" themeColor={day.isToday ? 'text' : 'textSecondary'}>
                          {day.label}
                        </ThemedText>
                      </View>
                      <View style={styles.calendarBubbleSlot}>
                        <View
                          style={[
                            styles.calendarBubble,
                            complete && styles.calendarBubbleDone,
                            todo && !missed && styles.calendarBubbleTodo,
                            missed && styles.calendarBubbleMissed,
                            selected && styles.calendarBubbleSelected,
                          ]}>
                          <ThemedText
                            type="smallBold"
                            style={[
                              complete && styles.calendarNumberDone,
                              missed && styles.calendarNumberMissed,
                            ]}>
                            {day.dayNumber}
                          </ThemedText>
                        </View>
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

              {selectedTasks.length === 0 && extraCompletedWorkouts.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No workouts scheduled for this day.
                </ThemedText>
              ) : (
                <>
                  {selectedTasks.map((task) => {
                    const incomplete = !task.completed && selectedDate < today;
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
                          <ThemedText type="small" themeColor="textSecondary">
                            {task.completed
                              ? 'Completed'
                              : `${incomplete ? 'Incomplete' : 'TODO'} · ${task.routine.durationMinutes} min`}
                          </ThemedText>
                        </View>
                        {!task.completed && <SymbolView name="chevron.right" size={12} tintColor={colors.textSecondary} />}
                      </Pressable>
                    );
                  })}
                  {extraCompletedWorkouts.map((workout) => (
                    <View key={workout.id} style={styles.scheduledRow}>
                      <View style={styles.flex}>
                        <ThemedText type="smallBold">{workout.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {`Completed · ${workout.minutes} min`}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ThemedView>

            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
              WEEKLY GOALS
            </ThemedText>
            <ThemedView type="surface" style={styles.card}>
              {goals.map((goal, index) => {
                const displayTarget = displayTargetFor(goal);
                const unitLabel =
                  goal.metric === 'water' ? volumeUnitLabel(unitSystem) : goal.unit || '/ week';
                const weekValue =
                  goal.metric === 'manual'
                    ? currentGoalValue(goal, sessions, cardioSessions, waterEntries, goalEntries)
                    : null;
                return (
                  <View key={goal.id} style={[styles.goalRow, index > 0 && styles.rowDivider]}>
                    {goal.metric === 'manual' ? (
                      <Pressable style={styles.goalCheckin} hitSlop={6} onPress={() => checkInGoal(goal)}>
                        <SymbolView name="plus" size={14} tintColor={colors.onPrimary} />
                      </Pressable>
                    ) : (
                      <View style={styles.goalIcon}>
                        <SymbolView name={METRIC_ICONS[goal.metric]} size={14} tintColor={colors.primaryLight} />
                      </View>
                    )}
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
                      {weekValue !== null && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {weekValue} this week
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.goalControls}>
                      <Pressable
                        hitSlop={6}
                        style={styles.stepperButton}
                        onPress={() => setGoalTarget(goal, displayTarget - METRIC_META[goal.metric].step)}>
                        <SymbolView name="minus" size={12} tintColor={colors.text} />
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
                        style={styles.stepperButton}
                        onPress={() => setGoalTarget(goal, displayTarget + METRIC_META[goal.metric].step)}>
                        <SymbolView name="plus" size={12} tintColor={colors.text} />
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => setGoals(goals.filter((existing) => existing.id !== goal.id))}>
                        <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <View style={[styles.inputRow, goals.length > 0 && styles.rowDivider]}>
                <TextInput
                  style={[styles.textInput, styles.flex]}
                  placeholder="Add a custom goal (e.g. Stretch)"
                  placeholderTextColor={colors.textSecondary}
                  value={newGoalLabel}
                  onChangeText={setNewGoalLabel}
                  onSubmitEditing={addCustomGoal}
                  returnKeyType="done"
                />
                <TextInput
                  style={[styles.textInput, styles.unitInput]}
                  placeholder="Unit"
                  placeholderTextColor={colors.textSecondary}
                  value={newGoalUnit}
                  onChangeText={setNewGoalUnit}
                  onSubmitEditing={addCustomGoal}
                  returnKeyType="done"
                />
                <IconButton icon="plus.circle.fill" active={!!newGoalLabel.trim()} onPress={addCustomGoal} />
              </View>

              {missingPresets.length > 0 && (
                <View style={[styles.suggestionRow, styles.rowDivider]}>
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

            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
              TODAY
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

            {waterGoal && (
              <>
                <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
                  WATER
                </ThemedText>
                <ThemedView type="surface" style={styles.card}>
                  <View style={styles.waterRow}>
                    <ThemedText type="subtitle">{formatVolume(todayWater, unitSystem)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      today
                    </ThemedText>
                  </View>
                  <Pressable
                    style={styles.quickAddButton}
                    onPress={() => addWater(unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL)}>
                    <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                      +{unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL} {volumeUnitLabel(unitSystem)}
                    </ThemedText>
                  </Pressable>
                  <View style={[styles.splitRow, styles.rowDivider, styles.waterCustomRow]}>
                    <TextInput
                      style={[styles.textInput, styles.flex]}
                      placeholder={`Custom amount (${volumeUnitLabel(unitSystem)})`}
                      placeholderTextColor={colors.textSecondary}
                      value={customWater}
                      onChangeText={setCustomWater}
                      keyboardType="decimal-pad"
                    />
                    <Pressable hitSlop={8} onPress={() => addCustomWater(-1)} disabled={!customWater.trim()}>
                      <SymbolView
                        name="minus.circle.fill"
                        size={24}
                        tintColor={customWater.trim() ? colors.textSecondary : colors.textMuted}
                      />
                    </Pressable>
                    <IconButton icon="plus.circle.fill" active={!!customWater.trim()} onPress={() => addCustomWater(1)} />
                  </View>
                </ThemedView>
              </>
            )}
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
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.three,
  },
  calendarCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDay: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  weekdayMarkerSlot: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.half,
  },
  todayMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
  },
  todayMarkerHidden: {
    opacity: 0,
  },
  calendarBubbleSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarBubbleSelected: {
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  calendarBubbleDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calendarBubbleTodo: {
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  calendarBubbleMissed: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.border,
  },
  calendarNumberDone: {
    color: colors.onPrimary,
  },
  calendarNumberMissed: {
    color: colors.textSecondary,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  goalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCheckin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
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
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 1,
    borderColor: colors.border,
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
  waterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  waterCustomRow: {
    paddingVertical: Spacing.three,
  },
  quickAddButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  splitRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  unitInput: {
    width: 72,
  },
});
