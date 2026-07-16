import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { ActivityRings } from '@/components/activity-rings';
import { Chevron } from '@/components/chevron';
import { GradientFill } from '@/components/gradient-fill';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaterBottle } from '@/components/water-bottle';
import { BottomTabInset, Colors, MaxContentWidth, Radius, RingColors, Spacing } from '@/constants/theme';
import { currentGoalValue, scheduledRoutineTasks, todayKey, todayWaterOunces } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { GoalDef } from '@/lib/store/types';
import { fromDisplayVolume, toDisplayVolume, volumeUnitLabel } from '@/lib/units';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const WATER_QUICK_ADD_IMPERIAL = 16;
const WATER_QUICK_ADD_METRIC = 500;

export default function DashboardScreen() {
  const { session } = useAuth();
  const {
    routines,
    sessions,
    cardioSessions,
    goals,
    checkoffDefs,
    checkoffLog,
    waterEntries,
    addWaterEntry,
    toggleCheckoff,
    preferences,
  } = useStore();
  const metadata = session?.user.user_metadata ?? {};
  const name = (metadata.full_name as string | undefined)?.trim() || session?.user.email?.split('@')[0] || 'there';

  const unitSystem = preferences.unitSystem;
  const today = todayKey();
  const doneToday = checkoffLog[today] ?? [];
  const scheduledTasks = scheduledRoutineTasks(routines, sessions, cardioSessions, today);

  const waterGoal = goals.find((goal) => goal.type === 'water');
  const todayWater = todayWaterOunces(waterEntries);
  const dailyWaterTarget = waterGoal ? Math.max(1, Math.round(waterGoal.target / 7)) : 0;
  const ringSize = waterGoal ? 168 : 240;
  const ringStrokeWidth = waterGoal ? 13 : 16;
  const ringGap = waterGoal ? 5 : 6;

  const addWater = (displayAmount: number) => {
    addWaterEntry({ id: makeId(), date: today, ounces: Math.round(fromDisplayVolume(displayAmount, unitSystem)) });
  };

  return (
    <TabFadeView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Hey, {name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Ready to train?
            </ThemedText>
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              TODAY
            </ThemedText>
            <Pressable hitSlop={8} onPress={() => router.push('/logging')}>
              <ThemedText type="small" style={{ color: colors.primaryLight }}>
                Edit
              </ThemedText>
            </Pressable>
          </View>

          <ThemedView type="surface" style={styles.todaySection}>

            {scheduledTasks.map((task) => {
              const path =
                task.routine.category === 'cardio'
                  ? { pathname: '/cardio/[id]' as const, params: { id: task.routine.id } }
                  : { pathname: '/workout/[id]' as const, params: { id: task.routine.id } };
              return (
                <Pressable
                  key={task.routine.id}
                  style={styles.todayRow}
                  onPress={() => router.push(path)}
                  disabled={task.completed}>
                  <View style={[styles.checkCircle, task.completed ? styles.checkCircleDone : styles.checkCircleTodo]}>
                    {task.completed && <SymbolView name="checkmark" size={12} tintColor={colors.text} />}
                  </View>
                  <View style={styles.todayText}>
                    <ThemedText type="smallBold">{task.routine.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {task.completed ? 'Completed today' : `${task.routine.durationMinutes} min · ${task.routine.level}`}
                    </ThemedText>
                  </View>
                  {!task.completed && <Chevron color={colors.textSecondary} />}
                </Pressable>
              );
            })}

            {scheduledTasks.length === 0 && checkoffDefs.length === 0 && (
              <View style={styles.todayRow}>
                <View style={[styles.todayIcon, { backgroundColor: colors.primaryTint }]}>
                  <SymbolView name="moon.zzz" size={15} tintColor={colors.primaryLight} />
                </View>
                <View style={styles.todayText}>
                  <ThemedText type="smallBold">Rest day</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Recover — nothing planned
                  </ThemedText>
                </View>
              </View>
            )}

            {checkoffDefs.map((def) => {
              const done = doneToday.includes(def.id);
              return (
                <Pressable key={def.id} style={styles.todayRow} onPress={() => toggleCheckoff(today, def.id)}>
                  <View
                    style={[
                      styles.checkCircle,
                      done
                        ? { backgroundColor: colors.primary }
                        : { borderWidth: 2, borderColor: colors.border },
                    ]}>
                    {done && <SymbolView name="checkmark" size={12} tintColor={colors.text} />}
                  </View>
                  <ThemedText type="small" themeColor={done ? 'textSecondary' : 'text'} style={styles.checkLabel}>
                    {def.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>

          <View style={styles.ringsRow}>
            <Pressable onPress={() => router.navigate('/logging')}>
              <ActivityRings
                animated
                size={ringSize}
                strokeWidth={ringStrokeWidth}
                gap={ringGap}
                rings={goals.map((goal, index) => ({
                  progress: currentGoalValue(goal, sessions, cardioSessions, waterEntries) / goal.target,
                  color: RingColors[index % RingColors.length],
                  trackColor: colors.border,
                }))}
              />
            </Pressable>

            {waterGoal && (
              <View style={styles.waterWidget}>
                <WaterBottle progress={todayWater / (dailyWaterTarget || 1)} size={64} />
                <ThemedText type="smallBold" numberOfLines={1}>
                  {toDisplayVolume(todayWater, unitSystem)}/{toDisplayVolume(dailyWaterTarget, unitSystem)}{' '}
                  {volumeUnitLabel(unitSystem)}
                </ThemedText>
                <Pressable
                  style={styles.waterButton}
                  onPress={() => addWater(unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL)}>
                  <ThemedText type="small" numberOfLines={1} style={{ color: colors.primaryLight }}>
                    +{unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL} {volumeUnitLabel(unitSystem)}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>

          {goals.length > 0 && (
            <View style={styles.ringsLegend}>
              {goals.map((goal, index) => (
                <LegendStat
                  key={goal.id}
                  color={RingColors[index % RingColors.length]}
                  goal={goal}
                  value={currentGoalValue(goal, sessions, cardioSessions, waterEntries)}
                  unitSystem={unitSystem}
                />
              ))}
            </View>
          )}

          <Pressable style={styles.startButton} onPress={() => router.push('/workout/choose')}>
            <GradientFill />
            <Svg width={14} height={16} viewBox="0 0 14 16">
              <Path d="M0 0l14 8-14 8z" fill={colors.text} />
            </Svg>
            <ThemedText type="subtitle" style={styles.startButtonText}>
              Start Workout
            </ThemedText>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </TabFadeView>
  );
}

function LegendStat({
  color,
  goal,
  value,
  unitSystem,
}: {
  color: string;
  goal: GoalDef;
  value: number;
  unitSystem: 'imperial' | 'metric';
}) {
  const isVolume = goal.type === 'water';
  const displayValue = isVolume ? toDisplayVolume(value, unitSystem) : Math.round(value);
  const displayTarget = isVolume ? toDisplayVolume(goal.target, unitSystem) : goal.target;
  const unitLabel = isVolume
    ? volumeUnitLabel(unitSystem)
    : goal.type === 'calories'
      ? 'cal'
      : goal.type === 'cardio'
        ? 'min cardio'
        : goal.type === 'workouts'
          ? 'workouts'
          : goal.unit;

  return (
    <View style={styles.legendStat}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="small">
        <ThemedText type="smallBold">{displayValue}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          /{displayTarget} {unitLabel}
        </ThemedText>
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  // ScrollView needs an explicit width here — `alignItems: 'center'` above means it otherwise
  // sizes to its own content instead of the viewport, so any row that's naturally wider than the
  // screen (long text, an unshrinkable button, …) silently pushes the whole page wider than the phone.
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  ringsLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  legendStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  waterWidget: {
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 130,
  },
  waterButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  startButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  startButtonText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todaySection: {
    gap: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  todayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    flex: 1,
    gap: Spacing.half,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: colors.primary,
  },
  checkCircleTodo: {
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  checkLabel: {
    flex: 1,
  },
});
