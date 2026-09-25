import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/animated-number';
import { DayTimeline } from '@/components/day-timeline';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaterBottle } from '@/components/water-bottle';
import { WaterEntrySheet } from '@/components/water-entry-sheet';
import { BottomTabInset, Colors, MaxContentWidth, Motion, Radius, Spacing } from '@/constants/theme';
import {
  dayLabel,
  dayTimeline,
  DEFAULT_NUTRITION_GOALS,
  nutritionForDate,
  shiftDateKey,
  timeOnDate,
  todayKey,
} from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { WaterEntry } from '@/lib/store/types';
import { useResetScrollOnFocus } from '@/lib/use-reset-scroll-on-focus';
import { fromDisplayVolume, toDisplayVolume, volumeUnitLabel } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const WATER_QUICK_ADD_IMPERIAL = 16;
const WATER_QUICK_ADD_METRIC = 500;
/** How often the NOW rule (and "Add at <now>") re-reads the clock. */
const CLOCK_TICK_MS = 60_000;

/** Ticking wall clock, so the timeline's NOW rule stays current while the tab is open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function NutritionScreen() {
  const {
    mealEvents,
    foodLogs,
    nutritionGoals,
    goals: userGoals,
    waterEntries,
    sessions,
    cardioSessions,
    addWaterEntry,
    updateWaterEntry,
    deleteWaterEntry,
    preferences,
  } = useStore();
  const scrollRef = useResetScrollOnFocus<ScrollView>();
  const [date, setDate] = useState(todayKey());
  const [editingWater, setEditingWater] = useState<WaterEntry | null>(null);
  const now = useNow();
  const { height: windowHeight } = useWindowDimensions();

  const goals = nutritionGoals ?? DEFAULT_NUTRITION_GOALS;
  const { totals } = useMemo(() => nutritionForDate(foodLogs, date), [foodLogs, date]);
  const remaining = Math.round(goals.calories - totals.calories);
  const timeline = useMemo(
    () => dayTimeline(date, { mealEvents, foodLogs, waterEntries, sessions, cardioSessions }, now),
    [date, mealEvents, foodLogs, waterEntries, sessions, cardioSessions, now],
  );

  const unitSystem = preferences.unitSystem;
  const isToday = date === todayKey();
  // Today logs at the real now; another day carries the current clock time
  // onto that date, which is close enough to adjust from.
  const nowDate = new Date(now);
  const addAt = isToday ? nowDate.toISOString() : timeOnDate(date, nowDate.getHours(), nowDate.getMinutes());

  const waterGoal = userGoals.find((goal) => goal.metric === 'water');
  const dayWaterEntries = waterEntries.filter((entry) => entry.date === date);
  const dayWater = dayWaterEntries.reduce((sum, entry) => sum + entry.ounces, 0);
  // Same weekly-target → daily-target math as the dashboard's water bento tile
  // (dashboard.tsx), so the two widgets never disagree.
  const dailyWaterTarget = waterGoal ? Math.max(1, Math.round(waterGoal.target / 7)) : 0;
  const quickAdd = unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL;
  const latestWater = dayWaterEntries
    .filter((entry) => entry.ounces > 0)
    .reduce<WaterEntry | null>((latest, entry) => (!latest || entry.loggedAt > latest.loggedAt ? entry : latest), null);

  const goToSearch = (at: string) => router.push({ pathname: '/food/search', params: { date, at } });

  const addWater = () => {
    const ounces = Math.round(fromDisplayVolume(quickAdd, unitSystem));
    addWaterEntry({ id: makeId(), date, ounces, loggedAt: addAt });
  };

  // Scroll the NOW rule into view when it sits below the fold; runs after
  // useResetScrollOnFocus's reset-to-top since that hook registered first.
  const timelineY = useRef(0);
  const [nowY, setNowY] = useState<number | null>(null);
  const scrollToNow = useCallback(() => {
    if (!isToday || nowY === null) return;
    const y = timelineY.current + nowY;
    if (y > windowHeight * 0.7) scrollRef.current?.scrollTo({ y: y - windowHeight * 0.5, animated: false });
  }, [isToday, nowY, windowHeight, scrollRef]);
  useFocusEffect(scrollToNow);

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View>
                <ThemedText type="subtitle">Nutrition</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Log meals and track your macros
                </ThemedText>
              </View>
              <Pressable hitSlop={8} onPress={() => router.push('/recipes')}>
                <ThemedText type="linkPrimary">Recipes</ThemedText>
              </Pressable>
            </View>

            <View style={styles.dayNav}>
              <Pressable
                hitSlop={8}
                style={styles.dayNavButton}
                onPress={() => setDate(shiftDateKey(date, -1))}>
                <SymbolView name="chevron.left" size={14} tintColor={colors.primaryLight} />
              </Pressable>
              <Pressable style={styles.dayNavLabel} onPress={() => setDate(todayKey())}>
                <ThemedText type="smallBold">{dayLabel(date)}</ThemedText>
                {date !== todayKey() && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Tap for today
                  </ThemedText>
                )}
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.dayNavButton}
                onPress={() => setDate(shiftDateKey(date, 1))}>
                <SymbolView name="chevron.right" size={14} tintColor={colors.primaryLight} />
              </Pressable>
            </View>

            <ThemedView type="surface" style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.calorieRow}>
                  <AnimatedNumber value={Math.round(totals.calories)} />
                  <ThemedText type="small">
                    / <ThemedText type="statInline">{Math.round(goals.calories)}</ThemedText> cal
                  </ThemedText>
                </View>
                <Pressable hitSlop={8} onPress={() => router.push('/food/goals')}>
                  <SymbolView name="pencil.circle" size={22} tintColor={colors.primaryLight} />
                </Pressable>
              </View>
              <RemainingCalories date={date} remaining={remaining} />

              {/* Lime for protein, then down the neutral ramp — the three bars
                  read apart without a second hue. */}
              <MacroBar label="Protein" value={totals.proteinG} target={goals.proteinG} color={colors.primary} />
              <MacroBar label="Carbs" value={totals.carbsG} target={goals.carbsG} color={colors.text} />
              <MacroBar label="Fat" value={totals.fatG} target={goals.fatG} color={colors.textSecondary} />
            </ThemedView>

            <View onLayout={(event) => (timelineY.current = event.nativeEvent.layout.y)}>
              <DayTimeline
                nodes={timeline}
                calorieGoal={goals.calories}
                unitSystem={unitSystem}
                defaultAddAt={addAt}
                onAddAt={goToSearch}
                onPressWater={setEditingWater}
                onNowLayout={setNowY}
              />
            </View>

            {waterGoal && (
              <>
                <ThemedText type="label" style={styles.sectionLabel}>
                  WATER
                </ThemedText>
                <ThemedView type="surface" style={styles.waterCard}>
                  <View style={styles.waterTopRow}>
                    <WaterBottle
                      progress={dailyWaterTarget > 0 ? dayWater / dailyWaterTarget : 0}
                      size={64}
                    />
                    <View style={styles.waterStats}>
                      <ThemedText type="subtitle">
                        {toDisplayVolume(dayWater, unitSystem)}
                        <ThemedText type="small" themeColor="textSecondary">
                          {' '}
                          / {toDisplayVolume(dailyWaterTarget, unitSystem)} {volumeUnitLabel(unitSystem)}
                        </ThemedText>
                      </ThemedText>
                      <View style={styles.waterButtonRow}>
                        {latestWater && (
                          <Pressable style={styles.waterMinusButton} onPress={() => deleteWaterEntry(latestWater.id)}>
                            <ThemedText type="smallBold" themeColor="textSecondary">
                              Undo last
                            </ThemedText>
                          </Pressable>
                        )}
                        <Pressable style={styles.quickAddButton} onPress={addWater}>
                          <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                            +{quickAdd} {volumeUnitLabel(unitSystem)}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </ThemedView>
              </>
            )}
          </ScrollView>
          <WaterEntrySheet
            entry={editingWater}
            unitSystem={unitSystem}
            onSave={updateWaterEntry}
            onDelete={deleteWaterEntry}
            onClose={() => setEditingWater(null)}
          />
        </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
}

/** Cross-fades the "remaining"/"over target" line when the viewed day changes. */
function RemainingCalories({ date, remaining }: { date: string; remaining: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(0);
    opacity.set(withTiming(1, { duration: Motion.base }));
  }, [date, opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View style={fadeStyle}>
      <ThemedText type="small" themeColor={remaining >= 0 ? 'text' : 'warning'}>
        <ThemedText type="statInline" themeColor={remaining >= 0 ? 'text' : 'warning'}>
          {Math.abs(remaining)}
        </ThemedText>
        {remaining >= 0 ? ' cal remaining' : ' cal over target'}
      </ThemedText>
    </Animated.View>
  );
}

function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: Motion.base }));
  }, [progress, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View style={styles.macroBar}>
      <View style={styles.macroLabels}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small">
          <ThemedText type="statInline">{Math.round(value)}</ThemedText>
          <ThemedText type="statInline" themeColor="textSecondary">
            /{Math.round(target)}
          </ThemedText>
          {' g'}
        </ThemedText>
      </View>
      <View style={styles.macroTrack}>
        <Animated.View style={[styles.macroFill, fillStyle, { backgroundColor: color }]} />
      </View>
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
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNavButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavLabel: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  summaryCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  waterCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
  },
  waterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  waterStats: {
    flex: 1,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  waterButtonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickAddButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  waterMinusButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  macroBar: {
    gap: Spacing.one,
  },
  macroLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 3,
  },
});
