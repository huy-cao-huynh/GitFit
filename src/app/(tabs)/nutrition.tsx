import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/animated-number';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaterBottle } from '@/components/water-bottle';
import { BottomTabInset, Colors, MaxContentWidth, Motion, Radius, Spacing } from '@/constants/theme';
import {
  dayLabel,
  DEFAULT_NUTRITION_GOALS,
  MEAL_LABELS,
  MEAL_ORDER,
  macroSummary,
  nutritionForDate,
  shiftDateKey,
  todayKey,
  todayWaterOunces,
} from '@/lib/store/derive';
import { haptics } from '@/lib/haptics';
import { makeId } from '@/lib/store/id';
import type { FoodLogEntry, MealType } from '@/lib/store/types';
import { useResetScrollOnFocus } from '@/lib/use-reset-scroll-on-focus';
import { fromDisplayVolume, toDisplayVolume, volumeUnitLabel } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const WATER_QUICK_ADD_IMPERIAL = 16;
const WATER_QUICK_ADD_METRIC = 500;

export default function NutritionScreen() {
  const { foodLogs, nutritionGoals, deleteFoodLog, goals: userGoals, waterEntries, addWaterEntry, preferences } =
    useStore();
  const scrollRef = useResetScrollOnFocus<ScrollView>();
  const [date, setDate] = useState(todayKey());

  const goals = nutritionGoals ?? DEFAULT_NUTRITION_GOALS;
  const { totals, byMeal, mealTotals } = useMemo(() => nutritionForDate(foodLogs, date), [foodLogs, date]);
  const remaining = Math.round(goals.calories - totals.calories);

  const unitSystem = preferences.unitSystem;
  const today = todayKey();
  const waterGoal = userGoals.find((goal) => goal.metric === 'water');
  const todayWater = todayWaterOunces(waterEntries);
  // Same weekly-target → daily-target math as the dashboard's water bento tile
  // (dashboard.tsx), so the two widgets never disagree.
  const dailyWaterTarget = waterGoal ? Math.max(1, Math.round(waterGoal.target / 7)) : 0;
  const quickAdd = unitSystem === 'metric' ? WATER_QUICK_ADD_METRIC : WATER_QUICK_ADD_IMPERIAL;

  const goToSearch = (meal: MealType) =>
    router.push({ pathname: '/food/search', params: { date, meal } });

  // Same confirmation shape as the food/[id] detail screen, so every delete
  // path in the app asks first.
  const confirmDelete = (entry: FoodLogEntry) => {
    Alert.alert('Delete entry?', `Removes ${entry.name} from your log for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.notification(Haptics.NotificationFeedbackType.Warning);
          deleteFoodLog(entry.id);
        },
      },
    ]);
  };

  const addWater = (displayAmount: number) => {
    let deltaOunces = Math.round(fromDisplayVolume(displayAmount, unitSystem));
    if (deltaOunces < 0) deltaOunces = Math.max(deltaOunces, -todayWater);
    if (deltaOunces === 0) return;
    addWaterEntry({ id: makeId(), date: today, ounces: deltaOunces });
  };

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

            {MEAL_ORDER.map((meal) => {
              const entries = byMeal[meal];
              const mealMacros = mealTotals[meal];
              const mealCalories = Math.round(mealMacros.calories);
              return (
                <View key={meal} style={styles.mealSection}>
                  <View style={styles.mealHeader}>
                    <ThemedText type="label" style={styles.sectionLabel}>
                      {MEAL_LABELS[meal].toUpperCase()}
                    </ThemedText>
                    {entries.length > 0 && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {mealCalories} cal · {macroSummary(mealMacros)}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedView type="surface" style={styles.mealCard}>
                    {entries.map((entry, index) => (
                      <FoodRow
                        key={entry.id}
                        entry={entry}
                        divider={index > 0}
                        onDelete={() => confirmDelete(entry)}
                      />
                    ))}
                    <Pressable
                      style={[styles.addRow, entries.length > 0 && styles.rowDivider]}
                      onPress={() => goToSearch(meal)}>
                      <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
                      <ThemedText type="small" style={{ color: colors.primaryLight }}>
                        Add food
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                </View>
              );
            })}

            {waterGoal && (
              <>
                <ThemedText type="label" style={styles.sectionLabel}>
                  WATER
                </ThemedText>
                <ThemedView type="surface" style={styles.waterCard}>
                  <View style={styles.waterTopRow}>
                    <WaterBottle
                      progress={dailyWaterTarget > 0 ? todayWater / dailyWaterTarget : 0}
                      size={64}
                    />
                    <View style={styles.waterStats}>
                      <ThemedText type="subtitle">
                        {toDisplayVolume(todayWater, unitSystem)}
                        <ThemedText type="small" themeColor="textSecondary">
                          {' '}
                          / {toDisplayVolume(dailyWaterTarget, unitSystem)} {volumeUnitLabel(unitSystem)}
                        </ThemedText>
                      </ThemedText>
                      <View style={styles.waterButtonRow}>
                        <Pressable style={styles.waterMinusButton} onPress={() => addWater(-quickAdd)}>
                          <ThemedText type="smallBold" themeColor="textSecondary">
                            −{quickAdd} {volumeUnitLabel(unitSystem)}
                          </ThemedText>
                        </Pressable>
                        <Pressable style={styles.quickAddButton} onPress={() => addWater(quickAdd)}>
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

/** Brand, serving size, then the condensed macro breakdown for this one entry. */
function servingLabel(entry: FoodLogEntry): string {
  const parts = [
    entry.brand,
    entry.grams !== undefined ? `${Math.round(entry.grams)} g` : undefined,
    macroSummary(entry),
  ].filter((part): part is string => !!part);
  return parts.join(' · ');
}

function FoodRow({
  entry,
  divider,
  onDelete,
}: {
  entry: FoodLogEntry;
  divider: boolean;
  onDelete: () => void;
}) {
  const serving = servingLabel(entry);
  return (
    <Pressable
      style={[styles.foodRow, divider && styles.rowDivider]}
      onPress={() => router.push({ pathname: '/food/[id]', params: { id: entry.id } })}>
      <View style={styles.foodText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {entry.name}
        </ThemedText>
        {serving && (
          <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
            {serving}
          </ThemedText>
        )}
      </View>
      <ThemedText type="statInline">{Math.round(entry.calories)}</ThemedText>
      <ThemedText type="small">cal</ThemedText>
      <Pressable hitSlop={8} onPress={onDelete}>
        <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
      </Pressable>
    </Pressable>
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
  mealSection: {
    gap: Spacing.two,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  foodText: {
    flex: 1,
    gap: Spacing.half,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
