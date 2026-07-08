import { useState, type ReactNode } from 'react';
import { router } from 'expo-router';
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
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { GlowBackground } from '@/components/glow-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import {
  ageFromBirthday,
  bmi,
  bodyFatPercent,
  calendarWeekDays,
  scheduledRoutineTasks,
  todayKey,
  todayWaterOunces,
  unscheduledCompletedWorkouts,
  type Sex,
} from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { GoalType } from '@/lib/store/types';
import {
  formatVolume,
  formatWeight,
  fromDisplayVolume,
  fromDisplayWeight,
  toDisplayVolume,
  volumeUnitLabel,
  weightUnitLabel,
} from '@/lib/units';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

function selectedDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface BuiltinGoalMeta {
  type: GoalType;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultTarget: number;
  isVolume?: boolean;
}

const BUILTIN_GOALS: BuiltinGoalMeta[] = [
  { type: 'workouts', label: 'Workouts', min: 1, max: 14, step: 1, defaultTarget: 5 },
  { type: 'calories', label: 'Calories', min: 100, max: 5000, step: 50, defaultTarget: 1500 },
  { type: 'cardio', label: 'Cardio', min: 0, max: 420, step: 5, defaultTarget: 60 },
  { type: 'water', label: 'Water', min: 0, max: 1000, step: 8, defaultTarget: 448, isVolume: true },
];

const WATER_QUICK_ADD_IMPERIAL = 16;
const WATER_QUICK_ADD_METRIC = 500;

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
    waterEntries,
    addWaterEntry,
    measurementDefs,
    setMeasurementDefs,
    measurementEntries,
    addBodyweight,
    addMeasurementEntry,
    preferences,
  } = useStore();
  const { session } = useAuth();

  const unitSystem = preferences.unitSystem;
  const today = todayKey();
  const doneToday = checkoffLog[today] ?? [];
  const latestWeight = bodyweight[bodyweight.length - 1];
  const [selectedDate, setSelectedDate] = useState(today);

  const metadata = session?.user.user_metadata ?? {};
  const heightInches = Number(metadata.height_inches as string | undefined) || null;
  const birthday = (metadata.birthday as string | undefined) || null;
  const sex = ((metadata.sex as string | undefined) ?? 'unset') as Sex | 'unset';
  const bmiValue = bmi(latestWeight?.weight ?? null, heightInches);
  const age = ageFromBirthday(birthday);
  const bodyFat = bodyFatPercent(bmiValue, age, sex === 'unset' ? null : sex);

  const waterGoal = goals.find((goal) => goal.type === 'water');
  const todayWater = todayWaterOunces(waterEntries);

  const [newCheckoff, setNewCheckoff] = useState('');
  const [editingGoal, setEditingGoal] = useState<GoalType | null>(null);
  const [editingGoalValue, setEditingGoalValue] = useState('');
  const [customWater, setCustomWater] = useState('');
  const [weight, setWeight] = useState('');
  const [newMeasurementLabel, setNewMeasurementLabel] = useState('');
  const [newMeasurementUnit, setNewMeasurementUnit] = useState(unitSystem === 'metric' ? 'cm' : 'in');
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const selectedDateObject = selectedDateFromKey(selectedDate);
  const selectedDateLabel = selectedDateObject.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const calendarDays = calendarWeekDays(routines, sessions, cardioSessions, selectedDateObject);
  const selectedTasks = scheduledRoutineTasks(routines, sessions, cardioSessions, selectedDate);
  const extraCompletedWorkouts = unscheduledCompletedWorkouts(routines, sessions, cardioSessions, selectedDate);

  const addCheckoff = () => {
    const name = newCheckoff.trim();
    if (!name) return;
    setCheckoffDefs([...checkoffDefs, { id: makeId(), name }]);
    setNewCheckoff('');
  };

  const saveWeight = () => {
    const displayValue = Number(weight);
    if (!Number.isFinite(displayValue) || displayValue <= 0) return;
    addBodyweight({ date: today, weight: fromDisplayWeight(displayValue, unitSystem) });
    setWeight('');
  };

  const toggleBuiltinGoal = (meta: BuiltinGoalMeta) => {
    const existing = goals.find((goal) => goal.type === meta.type);
    if (existing) {
      setGoals(goals.filter((goal) => goal.id !== existing.id));
      return;
    }
    setGoals([
      ...goals,
      { id: meta.type, type: meta.type, label: meta.label, target: meta.defaultTarget, unit: meta.isVolume ? 'oz' : '' },
    ]);
  };

  const setBuiltinTarget = (meta: BuiltinGoalMeta, displayValue: number) => {
    const clamped = Math.min(meta.max, Math.max(meta.min, displayValue));
    const target = meta.isVolume ? fromDisplayVolume(clamped, unitSystem) : clamped;
    setGoals(goals.map((goal) => (goal.type === meta.type ? { ...goal, target } : goal)));
  };

  const startEditingGoal = (meta: BuiltinGoalMeta, displayTarget: number) => {
    setEditingGoal(meta.type);
    setEditingGoalValue(String(displayTarget));
  };

  const commitEditingGoal = (meta: BuiltinGoalMeta) => {
    const value = Number(editingGoalValue);
    if (Number.isFinite(value) && value > 0) {
      setBuiltinTarget(meta, value);
    }
    setEditingGoal(null);
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

  const addMeasurementSection = () => {
    const label = newMeasurementLabel.trim();
    const unit = newMeasurementUnit.trim();
    if (!label || !unit) return;
    if (measurementDefs.some((def) => def.label.toLowerCase() === label.toLowerCase())) return;
    setMeasurementDefs([...measurementDefs, { id: makeId(), label, unit }]);
    setNewMeasurementLabel('');
  };

  const saveMeasurement = (defId: string, label: string, unit: string) => {
    const raw = measurementValues[defId];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    addMeasurementEntry({ id: makeId(), date: today, label, value, unit });
    setMeasurementValues((current) => ({ ...current, [defId]: '' }));
  };

  const latestMeasurementFor = (label: string) =>
    measurementEntries.find((entry) => entry.label === label);

  return (
    <TabFadeView style={styles.container}>
      <GlowBackground variant="cool" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.scrollWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scrollWrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Goals & Logging</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Track the metrics that do not live inside a workout.
              </ThemedText>
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              WORKOUT CALENDAR
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.calendarCard}>
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
                      <View style={styles.calendarBubbleGlow}>
                        {selected && (
                          <Svg
                            pointerEvents="none"
                            style={styles.calendarBubbleSelected}
                            width={48}
                            height={48}>
                            <Defs>
                              <RadialGradient id="calendarSelectedGlow" cx="50%" cy="50%" r="50%">
                                <Stop offset="0%" stopColor={Palette.purple} stopOpacity={0.35} />
                                <Stop offset="60%" stopColor={Palette.purple} stopOpacity={0.14} />
                                <Stop offset="100%" stopColor={Palette.purple} stopOpacity={0} />
                              </RadialGradient>
                            </Defs>
                            <Rect x={0} y={0} width={48} height={48} fill="url(#calendarSelectedGlow)" />
                          </Svg>
                        )}
                        <View
                          style={[
                            styles.calendarBubble,
                            complete && styles.calendarBubbleDone,
                            todo && !missed && styles.calendarBubbleTodo,
                            missed && styles.calendarBubbleMissed,
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

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              WEEKLY GOALS
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              {BUILTIN_GOALS.map((meta, index) => {
                const goal = goals.find((g) => g.type === meta.type);
                const displayTarget = goal ? (meta.isVolume ? toDisplayVolume(goal.target, unitSystem) : goal.target) : meta.defaultTarget;
                const unitLabel = meta.isVolume ? volumeUnitLabel(unitSystem) : meta.type === 'calories' ? 'cal' : meta.type === 'cardio' ? 'min' : '/ week';
                return (
                  <View key={meta.type} style={[styles.goalRow, index > 0 && styles.rowDivider]}>
                    <Pressable
                      style={styles.goalToggle}
                      onPress={() => toggleBuiltinGoal(meta)}
                      hitSlop={6}>
                      <View style={[styles.checkCircle, goal ? { backgroundColor: colors.accent } : styles.checkCircleOff]}>
                        {goal && <SymbolView name="checkmark" size={12} tintColor={colors.background} />}
                      </View>
                      <ThemedText type="small">{meta.label}</ThemedText>
                    </Pressable>
                    {goal && (
                      <View style={styles.goalControls}>
                        <Pressable
                          hitSlop={6}
                          style={styles.stepperButton}
                          onPress={() => setBuiltinTarget(meta, displayTarget - meta.step)}>
                          <SymbolView name="minus" size={12} tintColor={colors.text} />
                        </Pressable>
                        {editingGoal === meta.type ? (
                          <TextInput
                            style={styles.goalValueInput}
                            keyboardType="number-pad"
                            value={editingGoalValue}
                            onChangeText={setEditingGoalValue}
                            onSubmitEditing={() => commitEditingGoal(meta)}
                            onBlur={() => commitEditingGoal(meta)}
                            autoFocus
                            selectTextOnFocus
                            returnKeyType="done"
                          />
                        ) : (
                          <Pressable hitSlop={6} onPress={() => startEditingGoal(meta, displayTarget)}>
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
                          onPress={() => setBuiltinTarget(meta, displayTarget + meta.step)}>
                          <SymbolView name="plus" size={12} tintColor={colors.text} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ThemedView>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              TODAY
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
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
                        done ? { backgroundColor: colors.accent } : { borderWidth: 2, borderColor: colors.border },
                      ]}>
                      {done && <SymbolView name="checkmark" size={12} tintColor={colors.background} />}
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
                  style={styles.textInput}
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
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                  WATER
                </ThemedText>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.waterRow}>
                    <ThemedText type="subtitle">{formatVolume(todayWater, unitSystem)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      today
                    </ThemedText>
                  </View>
                  <Pressable
                    style={styles.quickAddButton}
                    onPress={() => addWater(unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL)}>
                    <ThemedText type="smallBold" style={{ color: colors.accent }}>
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
                        tintColor={customWater.trim() ? colors.textSecondary : colors.backgroundSelected}
                      />
                    </Pressable>
                    <IconButton icon="plus.circle.fill" active={!!customWater.trim()} onPress={() => addCustomWater(1)} />
                  </View>
                </ThemedView>
              </>
            )}

            <View style={styles.grid}>
              <QuickLogCard
                title="Body weight"
                latest={latestWeight ? formatWeight(latestWeight.weight, unitSystem) : 'No logs'}
                fields={
                  <TextInput
                    style={styles.textInput}
                    placeholder={`Weight (${weightUnitLabel(unitSystem)})`}
                    placeholderTextColor={colors.textSecondary}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                  />
                }
                onSave={saveWeight}
                canSave={!!weight.trim()}
              />

              <ThemedView type="backgroundElement" style={styles.logCard}>
                <ThemedText type="smallBold">BMI &amp; Body Fat</ThemedText>
                {bmiValue !== null ? (
                  <>
                    <ThemedText type="small">
                      BMI <ThemedText type="smallBold">{bmiValue}</ThemedText>
                    </ThemedText>
                    <ThemedText type="small">
                      Body fat{' '}
                      <ThemedText type="smallBold">{bodyFat !== null ? `${bodyFat}%` : '—'}</ThemedText>
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {bodyFat !== null
                        ? 'Rough estimate — accurate body-composition tracking is coming later.'
                        : 'Add birthday & sex in Settings for a body-fat estimate.'}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Log your weight and add height in Settings to see BMI.
                  </ThemedText>
                )}
              </ThemedView>
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              MEASUREMENTS
            </ThemedText>
            <View style={styles.grid}>
              {measurementDefs.map((def) => {
                const latest = latestMeasurementFor(def.label);
                return (
                  <QuickLogCard
                    key={def.id}
                    title={def.label}
                    latest={latest ? `${latest.value} ${latest.unit}` : 'No logs'}
                    fields={
                      <TextInput
                        style={styles.textInput}
                        placeholder={`Value (${def.unit})`}
                        placeholderTextColor={colors.textSecondary}
                        value={measurementValues[def.id] ?? ''}
                        onChangeText={(text) => setMeasurementValues((current) => ({ ...current, [def.id]: text }))}
                        keyboardType="decimal-pad"
                      />
                    }
                    onSave={() => saveMeasurement(def.id, def.label, def.unit)}
                    canSave={!!measurementValues[def.id]?.trim()}
                    onRemove={() => setMeasurementDefs(measurementDefs.filter((d) => d.id !== def.id))}
                  />
                );
              })}

              <ThemedView type="backgroundElement" style={styles.logCard}>
                <ThemedText type="smallBold">Add measurement section</ThemedText>
                <View style={styles.splitRow}>
                  <TextInput
                    style={[styles.textInput, styles.flex]}
                    placeholder="e.g. Chest"
                    placeholderTextColor={colors.textSecondary}
                    value={newMeasurementLabel}
                    onChangeText={setNewMeasurementLabel}
                  />
                  <TextInput
                    style={[styles.textInput, styles.unitInput]}
                    placeholder="Unit"
                    placeholderTextColor={colors.textSecondary}
                    value={newMeasurementUnit}
                    onChangeText={setNewMeasurementUnit}
                  />
                  <IconButton icon="plus.circle.fill" active={!!newMeasurementLabel.trim() && !!newMeasurementUnit.trim()} onPress={addMeasurementSection} />
                </View>
              </ThemedView>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TabFadeView>
  );
}

function QuickLogCard({
  title,
  latest,
  fields,
  onSave,
  canSave,
  onRemove,
}: {
  title: string;
  latest: string;
  fields: ReactNode;
  onSave: () => void;
  canSave: boolean;
  onRemove?: () => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.logCard}>
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {latest}
          </ThemedText>
        </View>
        {onRemove && (
          <Pressable hitSlop={8} onPress={onRemove}>
            <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
          </Pressable>
        )}
        <IconButton icon="checkmark.circle.fill" active={canSave} onPress={onSave} />
      </View>
      {fields}
    </ThemedView>
  );
}

function IconButton({ icon, active, onPress }: { icon: 'plus.circle.fill' | 'checkmark.circle.fill'; active: boolean; onPress: () => void }) {
  return (
    <Pressable hitSlop={8} onPress={onPress} disabled={!active}>
      <SymbolView name={icon} size={24} tintColor={active ? colors.accent : colors.backgroundSelected} />
    </Pressable>
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
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  calendarCard: {
    borderRadius: Spacing.four,
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
    backgroundColor: Palette.orange,
  },
  todayMarkerHidden: {
    opacity: 0,
  },
  calendarBubbleGlow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
    position: 'absolute',
    width: 48,
    height: 48,
  },
  calendarBubbleDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  calendarBubbleTodo: {
    borderWidth: 2,
    borderColor: colors.accentLight,
  },
  calendarBubbleMissed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(142,138,166,0.45)',
  },
  calendarNumberDone: {
    color: colors.background,
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
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  goalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalValue: {
    minWidth: 88,
    textAlign: 'center',
  },
  goalValueInput: {
    minWidth: 88,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: colors.backgroundSelected,
    color: colors.text,
    fontSize: 14,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundSelected,
    alignItems: 'center',
    justifyContent: 'center',
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
  checkCircleOff: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  textInput: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.backgroundSelected,
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
    borderRadius: Spacing.three,
    backgroundColor: colors.backgroundSelected,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  grid: {
    gap: Spacing.three,
  },
  logCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
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
