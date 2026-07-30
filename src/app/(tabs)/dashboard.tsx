import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DailyGoalsCard } from '@/components/daily-goals-card';
import { GoalDeck } from '@/components/goal-deck';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { TodayWorkoutCard } from '@/components/today-workout-card';
import { WaterBottle } from '@/components/water-bottle';
import { WeighInCard } from '@/components/weigh-in-card';
import { BottomTabInset, Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useResetScrollOnFocus } from '@/lib/use-reset-scroll-on-focus';
import { dashboardMetrics, scheduledRoutineTasks, todayKey, todayWaterOunces, weekdayForDate } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import { fromDisplayVolume, fromDisplayWeight, toDisplayVolume, volumeUnitLabel } from '@/lib/units';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const WATER_QUICK_ADD_IMPERIAL = 16;
const WATER_QUICK_ADD_METRIC = 500;
const BENTO_HEIGHT = 208;

export default function DashboardScreen() {
  const { session } = useAuth();
  const {
    routines,
    sessions,
    cardioSessions,
    goals,
    goalEntries,
    checkoffDefs,
    checkoffLog,
    waterEntries,
    foodLogs,
    nutritionGoals,
    steps,
    bodyweight,
    addWaterEntry,
    addBodyweight,
    toggleCheckoff,
    preferences,
  } = useStore();
  const metadata = session?.user.user_metadata ?? {};
  const name = (metadata.full_name as string | undefined)?.trim() || session?.user.email?.split('@')[0] || 'there';
  const scrollRef = useResetScrollOnFocus<ScrollView>();

  const unitSystem = preferences.unitSystem;
  const today = todayKey();
  const doneToday = checkoffLog[today] ?? [];
  const scheduledTasks = scheduledRoutineTasks(routines, sessions, cardioSessions, today);

  const metrics = dashboardMetrics(
    goals,
    sessions,
    cardioSessions,
    waterEntries,
    goalEntries,
    foodLogs,
    nutritionGoals,
    today,
    steps,
  );

  const waterGoal = goals.find((goal) => goal.metric === 'water');
  const todayWater = todayWaterOunces(waterEntries);
  const dailyWaterTarget = waterGoal ? Math.max(1, Math.round(waterGoal.target / 7)) : 0;

  const addWater = (displayAmount: number) => {
    addWaterEntry({ id: makeId(), date: today, ounces: Math.round(fromDisplayVolume(displayAmount, unitSystem)) });
  };

  const weighInGoal = goals.find((goal) => goal.metric === 'bodyweight');
  const showWeighInToday = !!weighInGoal && weekdayForDate(new Date()) === weighInGoal.target;
  const weightForToday = bodyweight.find((entry) => entry.date === today);
  const saveTodayWeight = (displayValue: number) => {
    addBodyweight({ date: today, weight: fromDisplayWeight(displayValue, unitSystem) });
  };

  const quickAdd = unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL;

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <ThemedText type="display">
                Hey,{' '}
                <ThemedText type="displayItalic" themeColor="primaryLight">
                  {name}
                </ThemedText>
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Ready to train?
              </ThemedText>
            </View>

            <GoalDeck metrics={metrics} unitSystem={unitSystem} />

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="label" style={styles.sectionLabel}>
                  Daily Goals
                </ThemedText>
                <Pressable onPress={() => router.navigate('/logging')} hitSlop={8}>
                  <ThemedText type="small" themeColor="primaryLight">
                    Edit
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.bento}>
                {waterGoal ? (
                  <View style={styles.waterCard}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      WATER
                    </ThemedText>
                    <WaterBottle progress={dailyWaterTarget > 0 ? todayWater / dailyWaterTarget : 0} size={44} />
                    <ThemedText type="statInline">
                      {toDisplayVolume(todayWater, unitSystem)}
                      <ThemedText type="small" themeColor="textSecondary">
                        /{toDisplayVolume(dailyWaterTarget, unitSystem)} {volumeUnitLabel(unitSystem)}
                      </ThemedText>
                    </ThemedText>
                    <Pressable
                      style={({ pressed }) => [styles.waterAdd, pressed && styles.waterAddPressed]}
                      onPress={() => addWater(quickAdd)}>
                      <ThemedText type="caption" themeColor="onPrimary">
                        +{quickAdd} {volumeUnitLabel(unitSystem)}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                <DailyGoalsCard
                  defs={checkoffDefs}
                  doneToday={doneToday}
                  checkoffLog={checkoffLog}
                  onToggle={(defId) => toggleCheckoff(today, defId)}
                />
              </View>

              {showWeighInToday && (
                <WeighInCard loggedToday={weightForToday} unitSystem={unitSystem} onSave={saveTodayWeight} />
              )}
            </View>

            <View style={styles.section}>
              <ThemedText type="label" style={styles.sectionLabel}>
                Today&apos;s Workout
              </ThemedText>
              <TodayWorkoutCard tasks={scheduledTasks} />
              {/* Deliberately separate from the card's play button: this one
                  starts something unscheduled, which is the only way in when
                  today is a rest day. */}
              <Pressable
                style={({ pressed }) => [styles.newWorkoutButton, pressed && styles.newWorkoutButtonPressed]}
                onPress={() => {
                  haptics.impact();
                  router.push('/workout/choose');
                }}>
                <SymbolView name="plus" size={16} tintColor={colors.onPrimary} />
                <ThemedText type="button" themeColor="onPrimary">
                  New Workout
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  bento: {
    flexDirection: 'row',
    gap: Spacing.two,
    // Fixed, not capped: DailyGoalsCard is `flex: 1` and has no intrinsic
    // height of its own — it was only getting a height because the water
    // card's own content sized the row. Without a water goal (no water card),
    // an unbounded row collapses that flexed child to zero height. A fixed
    // height gives both children something to stretch to; a long goal list
    // still scrolls inside its card rather than stretching the row.
    height: BENTO_HEIGHT,
  },
  waterCard: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  waterAdd: {
    borderRadius: Radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  waterAddPressed: {
    backgroundColor: colors.primaryDark,
  },
  newWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.three,
  },
  newWorkoutButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
});
