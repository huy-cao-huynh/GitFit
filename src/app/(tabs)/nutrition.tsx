import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedNumber } from '@/components/animated-number';
import { ScreenBackground } from '@/components/screen-background';
import { Stepper } from '@/components/stepper';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  dayLabel,
  MEAL_LABELS,
  MEAL_ORDER,
  nutritionForDate,
  shiftDateKey,
  todayKey,
} from '@/lib/store/derive';
import type { FoodLogEntry, MealType, NutritionGoals } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

/** Shown (and written on first edit) until the user sets their own targets. */
const DEFAULT_GOALS: NutritionGoals = { calories: 2000, proteinG: 140, carbsG: 220, fatG: 65 };

export default function NutritionScreen() {
  const { foodLogs, nutritionGoals, setNutritionGoals, deleteFoodLog } = useStore();
  const [date, setDate] = useState(todayKey());
  const [editingGoals, setEditingGoals] = useState(false);

  const goals = nutritionGoals ?? DEFAULT_GOALS;
  const { totals, byMeal } = nutritionForDate(foodLogs, date);
  const remaining = Math.round(goals.calories - totals.calories);

  const updateGoal = (patch: Partial<NutritionGoals>) => {
    setNutritionGoals({ ...goals, ...patch });
  };

  const goToSearch = (meal: MealType) =>
    router.push({ pathname: '/food/search', params: { date, meal } });

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground pattern="dots">
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <ThemedText type="subtitle">Nutrition</ThemedText>
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
                  <ThemedText type="small" themeColor="textSecondary">
                    / {Math.round(goals.calories)} cal
                  </ThemedText>
                </View>
                <Pressable hitSlop={8} onPress={() => setEditingGoals((editing) => !editing)}>
                  <SymbolView
                    name={editingGoals ? 'checkmark.circle.fill' : 'pencil.circle'}
                    size={22}
                    tintColor={colors.primaryLight}
                  />
                </Pressable>
              </View>
              <ThemedText type="small" themeColor={remaining >= 0 ? 'textSecondary' : 'warning'}>
                {remaining >= 0 ? `${remaining} cal remaining` : `${-remaining} cal over target`}
              </ThemedText>

              <MacroBar label="Protein" value={totals.proteinG} target={goals.proteinG} color={colors.volt} />
              <MacroBar label="Carbs" value={totals.carbsG} target={goals.carbsG} color={colors.primaryLight} />
              <MacroBar label="Fat" value={totals.fatG} target={goals.fatG} color={colors.warning} />

              {editingGoals && (
                <View style={styles.goalEditor}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                    DAILY TARGETS
                  </ThemedText>
                  <View style={styles.goalStepperRow}>
                    <Stepper
                      label="Calories"
                      value={goals.calories}
                      min={800}
                      max={8000}
                      step={50}
                      onChange={(calories) => updateGoal({ calories })}
                    />
                    <Stepper
                      label="Protein g"
                      value={goals.proteinG}
                      min={0}
                      max={500}
                      step={5}
                      onChange={(proteinG) => updateGoal({ proteinG })}
                    />
                  </View>
                  <View style={styles.goalStepperRow}>
                    <Stepper
                      label="Carbs g"
                      value={goals.carbsG}
                      min={0}
                      max={800}
                      step={5}
                      onChange={(carbsG) => updateGoal({ carbsG })}
                    />
                    <Stepper
                      label="Fat g"
                      value={goals.fatG}
                      min={0}
                      max={300}
                      step={5}
                      onChange={(fatG) => updateGoal({ fatG })}
                    />
                  </View>
                </View>
              )}
            </ThemedView>

            {MEAL_ORDER.map((meal) => {
              const entries = byMeal[meal];
              const mealCalories = Math.round(
                entries.reduce((sum, entry) => sum + entry.calories, 0),
              );
              return (
                <View key={meal} style={styles.mealSection}>
                  <View style={styles.mealHeader}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                      {MEAL_LABELS[meal].toUpperCase()}
                    </ThemedText>
                    {mealCalories > 0 && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {mealCalories} cal
                      </ThemedText>
                    )}
                  </View>
                  <ThemedView type="surface" style={styles.mealCard}>
                    {entries.map((entry, index) => (
                      <FoodRow
                        key={entry.id}
                        entry={entry}
                        divider={index > 0}
                        onDelete={() => deleteFoodLog(entry.id)}
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
          </ScrollView>
        </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
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
  return (
    <Pressable
      style={[styles.foodRow, divider && styles.rowDivider]}
      onPress={() => router.push({ pathname: '/food/[id]', params: { id: entry.id } })}>
      <View style={styles.foodText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {entry.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {entry.brand ? `${entry.brand} · ` : ''}
          {entry.grams !== undefined ? `${Math.round(entry.grams)} g · ` : ''}
          {Math.round(entry.proteinG)}p / {Math.round(entry.carbsG)}c / {Math.round(entry.fatG)}f
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{Math.round(entry.calories)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        cal
      </ThemedText>
      <Pressable hitSlop={8} onPress={onDelete}>
        <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textMuted} />
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
  return (
    <View style={styles.macroBar}>
      <View style={styles.macroLabels}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="small">
          {Math.round(value)}
          <ThemedText type="small" themeColor="textSecondary">
            /{Math.round(target)} g
          </ThemedText>
        </ThemedText>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
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
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
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
  goalEditor: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalStepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    borderWidth: 1,
    borderColor: colors.border,
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
