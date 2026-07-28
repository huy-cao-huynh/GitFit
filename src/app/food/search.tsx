import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientFill } from '@/components/gradient-fill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Gradients, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  gramsToOunces,
  macrosForGrams,
  ouncesToGrams,
  searchFoods,
  type FoodSearchResult,
} from '@/lib/nutrition/open-food-facts';
import { MEAL_LABELS, MEAL_ORDER, recipePerServing, scaleMacros, todayKey } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { MealType, Recipe } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const SEARCH_DEBOUNCE_MS = 400;

type AmountUnit = 'g' | 'oz';

export default function FoodSearchScreen() {
  const params = useLocalSearchParams<{ date?: string; meal?: MealType }>();
  const { recipes, addFoodLog } = useStore();
  const date = params.date ?? todayKey();

  const [meal, setMeal] = useState<MealType>(params.meal ?? 'breakfast');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search; aborts the in-flight request when the query changes.
  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(
      async () => {
        abortRef.current?.abort();
        if (trimmed.length < 2) {
          setResults([]);
          setSearching(false);
          setSearchError(null);
          return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setSearching(true);
        setSearchError(null);
        try {
          const found = await searchFoods(trimmed, controller.signal);
          if (!controller.signal.aborted) {
            setResults(found);
            setSearching(false);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setSearching(false);
            setSearchError(error instanceof Error ? error.message : 'Search failed');
          }
        }
      },
      trimmed.length < 2 ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query]);

  const logAndClose = (entry: Parameters<typeof addFoodLog>[0]) => {
    addFoodLog(entry);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.topRow}>
            <Pressable hitSlop={12} onPress={() => router.back()}>
              <ThemedText type="link" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold">Add Food</ThemedText>
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.mealChips}>
            {MEAL_ORDER.map((option) => {
              const active = meal === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.mealChip, active && styles.mealChipActive]}
                  onPress={() => setMeal(option)}>
                  <ThemedText type="small" themeColor={active ? 'onPrimary' : 'textSecondary'}>
                    {MEAL_LABELS[option]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {selected ? (
            <AmountPanel
              food={selected}
              onBack={() => setSelected(null)}
              onLog={(grams, macros) =>
                logAndClose({
                  id: makeId(),
                  date,
                  meal,
                  name: selected.name,
                  brand: selected.brand,
                  grams,
                  ...macros,
                })
              }
            />
          ) : showCustom ? (
            <CustomFoodPanel
              onBack={() => setShowCustom(false)}
              onLog={(entry) => logAndClose({ id: makeId(), date, meal, ...entry })}
            />
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search foods (e.g. greek yogurt)"
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />

              <Pressable style={styles.customRow} onPress={() => setShowCustom(true)}>
                <SymbolView name="square.and.pencil" size={18} tintColor={colors.primaryLight} />
                <ThemedText type="small" style={{ color: colors.primaryLight }}>
                  Add a custom food
                </ThemedText>
              </Pressable>

              {searching && <ActivityIndicator style={styles.spinner} color={colors.primaryLight} />}
              {searchError && (
                <ThemedText type="small" themeColor="danger">
                  Couldn&apos;t search foods — check your connection. ({searchError})
                </ThemedText>
              )}

              {results.map((result) => (
                <Pressable
                  key={result.code}
                  style={styles.resultRow}
                  onPress={() => setSelected(result)}>
                  <View style={styles.resultText}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {result.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {result.brand ? `${result.brand} · ` : ''}
                      {Math.round(result.caloriesPer100g)} cal / 100 g
                    </ThemedText>
                  </View>
                  <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
                </Pressable>
              ))}

              {recipes.length > 0 && query.trim().length < 2 && (
                <View style={styles.recipeSection}>
                  <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
                    RECIPE BOOK
                  </ThemedText>
                  {recipes.map((recipe) => (
                    <RecipeRow
                      key={recipe.id}
                      recipe={recipe}
                      onLog={(servings) => {
                        const macros = scaleMacros(recipePerServing(recipe), servings);
                        logAndClose({
                          id: makeId(),
                          date,
                          meal,
                          name: servings === 1 ? recipe.name : `${recipe.name} ×${servings}`,
                          ...macros,
                        });
                      }}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function AmountPanel({
  food,
  onBack,
  onLog,
}: {
  food: FoodSearchResult;
  onBack: () => void;
  onLog: (grams: number, macros: ReturnType<typeof macrosForGrams>) => void;
}) {
  const [unit, setUnit] = useState<AmountUnit>('g');
  const [amountText, setAmountText] = useState('100');

  const amount = Number(amountText) || 0;
  const grams = unit === 'g' ? amount : ouncesToGrams(amount);
  const macros = macrosForGrams(food, grams);

  const switchUnit = (next: AmountUnit) => {
    if (next === unit) return;
    const converted = next === 'g' ? ouncesToGrams(amount) : gramsToOunces(amount);
    setAmountText(String(Math.round(converted * 10) / 10));
    setUnit(next);
  };

  return (
    <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={onBack}>
        <SymbolView name="chevron.left" size={12} tintColor={colors.primaryLight} />
        <ThemedText type="small" style={{ color: colors.primaryLight }}>
          Back to results
        </ThemedText>
      </Pressable>

      <ThemedText type="heading">{food.name}</ThemedText>
      {food.brand && (
        <ThemedText type="small" themeColor="textSecondary">
          {food.brand}
          {food.servingSize ? ` · serving ${food.servingSize}` : ''}
        </ThemedText>
      )}

      <ThemedView type="surface" style={styles.panelCard}>
        <ThemedText type="small" themeColor="textSecondary">
          Amount
        </ThemedText>
        <View style={styles.amountRow}>
          <TextInput
            style={styles.amountInput}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          {(['g', 'oz'] as AmountUnit[]).map((option) => (
            <Pressable
              key={option}
              style={[styles.unitChip, unit === option && styles.unitChipActive]}
              onPress={() => switchUnit(option)}>
              <ThemedText type="small" themeColor={unit === option ? 'onPrimary' : 'textSecondary'}>
                {option}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.macroPreview}>
          <PreviewStat value={macros.calories} label="cal" emphasized />
          <PreviewStat value={macros.proteinG} label="protein" />
          <PreviewStat value={macros.carbsG} label="carbs" />
          <PreviewStat value={macros.fatG} label="fat" />
        </View>
      </ThemedView>

      <Pressable
        style={[styles.primaryButton, grams <= 0 && styles.primaryButtonDisabled]}
        disabled={grams <= 0}
        onPress={() => onLog(Math.round(grams * 10) / 10, macros)}>
        <GradientFill stops={Gradients.cta} />
        <ThemedText type="smallBold" style={styles.primaryButtonText}>
          Log Food
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function CustomFoodPanel({
  onBack,
  onLog,
}: {
  onBack: () => void;
  onLog: (entry: {
    name: string;
    grams?: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [gramsText, setGramsText] = useState('');
  const [caloriesText, setCaloriesText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [carbsText, setCarbsText] = useState('');
  const [fatText, setFatText] = useState('');

  const calories = Number(caloriesText) || 0;
  const canLog = name.trim().length > 0 && calories > 0;

  return (
    <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={onBack}>
        <SymbolView name="chevron.left" size={12} tintColor={colors.primaryLight} />
        <ThemedText type="small" style={{ color: colors.primaryLight }}>
          Back to search
        </ThemedText>
      </Pressable>

      <ThemedText type="heading">Custom food</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Enter the nutrients for the amount you ate.
      </ThemedText>

      <ThemedView type="surface" style={styles.panelCard}>
        <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom's lasagna" />
        <View style={styles.customGrid}>
          <LabeledInput label="Calories" value={caloriesText} onChangeText={setCaloriesText} numeric compact />
          <LabeledInput label="Grams (optional)" value={gramsText} onChangeText={setGramsText} numeric compact />
        </View>
        <View style={styles.customGrid}>
          <LabeledInput label="Protein g" value={proteinText} onChangeText={setProteinText} numeric compact />
          <LabeledInput label="Carbs g" value={carbsText} onChangeText={setCarbsText} numeric compact />
          <LabeledInput label="Fat g" value={fatText} onChangeText={setFatText} numeric compact />
        </View>
      </ThemedView>

      <Pressable
        style={[styles.primaryButton, !canLog && styles.primaryButtonDisabled]}
        disabled={!canLog}
        onPress={() =>
          onLog({
            name: name.trim(),
            grams: Number(gramsText) > 0 ? Number(gramsText) : undefined,
            calories,
            proteinG: Number(proteinText) || 0,
            carbsG: Number(carbsText) || 0,
            fatG: Number(fatText) || 0,
          })
        }>
        <GradientFill stops={Gradients.cta} />
        <ThemedText type="smallBold" style={styles.primaryButtonText}>
          Log Food
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function RecipeRow({ recipe, onLog }: { recipe: Recipe; onLog: (servings: number) => void }) {
  const [servings, setServings] = useState(1);
  const perServing = recipePerServing(recipe);
  return (
    <View style={styles.resultRow}>
      <View style={styles.resultText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {recipe.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(perServing.calories)} cal / serving
        </ThemedText>
      </View>
      <View style={styles.servingStepper}>
        <Pressable hitSlop={6} onPress={() => setServings((s) => Math.max(1, s - 1))}>
          <SymbolView name="minus.circle" size={20} tintColor={colors.textSecondary} />
        </Pressable>
        <ThemedText type="smallBold">{servings}</ThemedText>
        <Pressable hitSlop={6} onPress={() => setServings((s) => s + 1)}>
          <SymbolView name="plus.circle" size={20} tintColor={colors.textSecondary} />
        </Pressable>
      </View>
      <Pressable hitSlop={8} onPress={() => onLog(servings)}>
        <SymbolView name="plus.circle.fill" size={22} tintColor={colors.primaryLight} />
      </Pressable>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
  compact,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  numeric?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.labeledInput, compact && styles.flex]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
      />
    </View>
  );
}

function PreviewStat({ value, label, emphasized }: { value: number; label: string; emphasized?: boolean }) {
  return (
    <View style={styles.previewStat}>
      <ThemedText type={emphasized ? 'stat' : 'smallBold'} style={emphasized ? styles.previewEmphasis : undefined}>
        {Math.round(value)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  topSpacer: {
    width: 48,
  },
  mealChips: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  mealChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealChipActive: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  searchInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: colors.text,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  spinner: {
    paddingVertical: Spacing.three,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  resultText: {
    flex: 1,
    gap: Spacing.half,
  },
  recipeSection: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  servingStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  panelContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  panelCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  amountInput: {
    flex: 1,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 18,
  },
  unitChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
  },
  macroPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewStat: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  previewEmphasis: {
    color: colors.primaryLight,
  },
  labeledInput: {
    gap: Spacing.one,
  },
  customGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  textInput: {
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    color: colors.text,
  },
  primaryButton: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.onPrimary,
  },
});
