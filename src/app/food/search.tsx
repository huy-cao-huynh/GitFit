import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimeField } from '@/components/time-field';
import { Colors, MaxContentWidth, Motion, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { searchFoods } from '@/lib/nutrition/usda-food-data-central';
import {
  gramsToOunces,
  macrosForGrams,
  ouncesToGrams,
  parseServingGrams,
  type FoodSearchResult,
} from '@/lib/nutrition/units';
import {
  addMacros,
  defaultTimeOnDate,
  EMPTY_MACROS,
  formatClock,
  mealEventTitle,
  recentFoods,
  recipePerServing,
  scaleMacros,
  suggestMealTitle,
  todayKey,
  type RecentFood,
} from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { FoodLogEntry, Macros, Recipe } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;
const SEARCH_DEBOUNCE_MS = 400;
/** Rows shown per tier before the "show N more" row. Both tiers fetch deeper than this so ranking has candidates to sort. */
const BASIC_PREVIEW_COUNT = 8;
const BRANDED_PREVIEW_COUNT = 5;

type AmountUnit = 'g' | 'oz';
type AmountMode = 'servings' | 'custom';

/** What `AmountPanel` needs to compute macros/preview — satisfied by both a fresh search result and a recent food. */
type AmountFood = Pick<
  FoodSearchResult,
  'name' | 'brand' | 'servingSize' | 'caloriesPer100g' | 'proteinPer100g' | 'carbsPer100g' | 'fatPer100g'
>;

/** A food picked in this visit, waiting in the basket to be logged with the rest. */
type BasketItem = Omit<FoodLogEntry, 'date' | 'eventId'>;

/** Either a weight-based food (search result / recent food, scales by grams) or a recipe (scales by serving count). */
type AmountSource =
  | { kind: 'weight'; food: AmountFood; initialGrams: number }
  | { kind: 'recipe'; recipe: Recipe };

export default function FoodSearchScreen() {
  // `eventId` appends to an existing meal event; otherwise a new event is
  // created at `at` (defaulting to now on `date`).
  const params = useLocalSearchParams<{ date?: string; at?: string; eventId?: string }>();
  const { recipes, foodLogs, mealEvents, logMealEvent, addFoodLogs } = useStore();
  const existingEvent = params.eventId ? mealEvents.find((event) => event.id === params.eventId) : undefined;
  const date = existingEvent?.date ?? params.date ?? todayKey();
  const recents = recentFoods(foodLogs);

  const [loggedAt, setLoggedAt] = useState(() => params.at ?? defaultTimeOnDate(date));
  const [title, setTitle] = useState('');
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AmountSource | null>(null);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showAllBasic, setShowAllBasic] = useState(false);
  const [showAllBranded, setShowAllBranded] = useState(false);
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
        // A new query means new tails — don't carry the expanded state over.
        setShowAllBasic(false);
        setShowAllBranded(false);
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

  // The provider hands back one ranked list with a `tier` on each result; the
  // two sections are just a partition of it.
  const basicResults = useMemo(() => results.filter((result) => result.tier === 'basic'), [results]);
  const brandedResults = useMemo(() => results.filter((result) => result.tier === 'branded'), [results]);
  const hasSettledQuery = query.trim().length >= 2 && !searching && !searchError;

  // Picking a food drops it in the basket and returns to the list, so a
  // multi-food meal is one visit; nothing is written until "Log N items".
  const addToBasket = (item: BasketItem) => {
    haptics.selection();
    setBasket((current) => [...current, item]);
    setSelected(null);
    setShowRecipes(false);
    setShowCustom(false);
  };

  const logBasket = () => {
    if (basket.length === 0) return;
    haptics.impact();
    if (existingEvent) {
      addFoodLogs(basket.map((item) => ({ ...item, date, eventId: existingEvent.id })));
    } else {
      const eventId = makeId();
      const trimmed = title.trim();
      logMealEvent(
        { id: eventId, date, loggedAt, title: trimmed.length > 0 ? trimmed : undefined },
        basket.map((item) => ({ ...item, date, eventId })),
      );
    }
    router.back();
  };

  const cancel = () => {
    if (basket.length === 0) {
      router.back();
      return;
    }
    Alert.alert('Discard this meal?', `${basket.length} picked food${basket.length === 1 ? '' : 's'} won't be logged.`, [
      { text: 'Keep picking', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const showingList = !selected && !showRecipes && !showCustom;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.topRow}>
            <Pressable hitSlop={12} onPress={cancel}>
              <ThemedText type="link" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.topTitle}>
              {existingEvent ? `Add to ${mealEventTitle(existingEvent)}` : 'New Meal'}
            </ThemedText>
            <View style={styles.topSpacer} />
          </View>

          {existingEvent ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.eventMeta}>
              Logged at <ThemedText type="statInline">{formatClock(existingEvent.loggedAt)}</ThemedText>
            </ThemedText>
          ) : (
            <View style={styles.eventMeta}>
              <TimeField date={date} value={loggedAt} onChange={setLoggedAt} />
              <TextInput
                style={styles.titleInput}
                placeholder={`${suggestMealTitle(loggedAt)} (title optional)`}
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                returnKeyType="done"
              />
            </View>
          )}

          {selected ? (
            <AmountPanel
              source={selected}
              onBack={() => setSelected(null)}
              onLog={(result) => {
                if (selected.kind === 'weight') {
                  addToBasket({
                    id: makeId(),
                    name: selected.food.name,
                    brand: selected.food.brand,
                    grams: result.grams,
                    ...result.macros,
                  });
                } else {
                  const count = Math.round(result.servings * 100) / 100;
                  addToBasket({
                    id: makeId(),
                    name: count === 1 ? selected.recipe.name : `${selected.recipe.name} ×${count}`,
                    ...result.macros,
                  });
                }
              }}
            />
          ) : showRecipes ? (
            <RecipePickerPanel
              recipes={recipes}
              onBack={() => setShowRecipes(false)}
              onSelect={(recipe) => setSelected({ kind: 'recipe', recipe })}
            />
          ) : showCustom ? (
            <CustomFoodPanel
              onBack={() => setShowCustom(false)}
              onLog={(entry) => addToBasket({ id: makeId(), ...entry })}
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
                // Only on the first visit — returning with a basket shouldn't
                // throw the keyboard over the tray.
                autoFocus={basket.length === 0}
              />

              <View style={styles.entryPointRow}>
                <Pressable
                  style={styles.customRow}
                  onPress={() => {
                    haptics.selection();
                    setShowRecipes(true);
                  }}>
                  <SymbolView name="fork.knife" size={18} tintColor={colors.primaryLight} />
                  <ThemedText type="small" style={{ color: colors.primaryLight }}>
                    Log a recipe
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.customRow}
                  onPress={() => {
                    haptics.selection();
                    setShowCustom(true);
                  }}>
                  <SymbolView name="square.and.pencil" size={18} tintColor={colors.primaryLight} />
                  <ThemedText type="small" style={{ color: colors.primaryLight }}>
                    Add a custom food
                  </ThemedText>
                </Pressable>
              </View>

              {recents.length > 0 && query.trim().length < 2 && (
                <View style={styles.recipeSection}>
                  <ThemedText type="label" style={styles.sectionLabel}>
                    RECENTLY EATEN
                  </ThemedText>
                  {recents.map((food) => (
                    <RecentFoodRow
                      key={`${food.name}|${food.brand ?? ''}`}
                      food={food}
                      onPress={() => setSelected({ kind: 'weight', food, initialGrams: food.grams })}
                    />
                  ))}
                </View>
              )}

              {searching && <ActivityIndicator style={styles.spinner} color={colors.primaryLight} />}
              {searchError && (
                <ThemedText type="small" themeColor="danger">
                  Couldn&apos;t search foods — check your connection. ({searchError})
                </ThemedText>
              )}

              <ResultSection
                label="BASIC FOODS"
                results={basicResults}
                previewCount={BASIC_PREVIEW_COUNT}
                expanded={showAllBasic}
                onExpand={() => setShowAllBasic(true)}
                onSelect={(result) => setSelected({ kind: 'weight', food: result, initialGrams: 100 })}
              />

              <ResultSection
                label="BRANDED"
                results={brandedResults}
                previewCount={BRANDED_PREVIEW_COUNT}
                expanded={showAllBranded}
                onExpand={() => setShowAllBranded(true)}
                onSelect={(result) => setSelected({ kind: 'weight', food: result, initialGrams: 100 })}
              />

              {hasSettledQuery && results.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  No matches — try a simpler term, or add a custom food.
                </ThemedText>
              )}

              {recipes.length > 0 && query.trim().length < 2 && (
                <View style={styles.recipeSection}>
                  <ThemedText type="label" style={styles.sectionLabel}>
                    RECIPE BOOK
                  </ThemedText>
                  {recipes.map((recipe) => (
                    <RecipeSearchRow
                      key={recipe.id}
                      recipe={recipe}
                      onPress={() => setSelected({ kind: 'recipe', recipe })}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {showingList && basket.length > 0 && (
            <BasketTray
              items={basket}
              onRemove={(id) => setBasket((current) => current.filter((item) => item.id !== id))}
              onLog={logBasket}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** The foods picked so far, pinned under the list with the one "Log N items" action. */
function BasketTray({
  items,
  onRemove,
  onLog,
}: {
  items: BasketItem[];
  onRemove: (id: string) => void;
  onLog: () => void;
}) {
  const totals = items.reduce<Macros>((sum, item) => addMacros(sum, item), EMPTY_MACROS);
  return (
    <View style={styles.tray}>
      <ScrollView style={styles.trayList} contentContainerStyle={styles.trayListContent}>
        {items.map((item) => (
          <View key={item.id} style={styles.trayRow}>
            <ThemedText type="small" numberOfLines={1} style={styles.flex}>
              {item.name}
            </ThemedText>
            <ThemedText type="small">
              <ThemedText type="statInline">{Math.round(item.calories)}</ThemedText> cal
            </ThemedText>
            <Pressable hitSlop={8} onPress={() => onRemove(item.id)}>
              <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Pressable style={({ pressed }) => [styles.trayButton, pressed && styles.trayButtonPressed]} onPress={onLog}>
        <ThemedText type="smallBold" themeColor="onPrimary">
          Log {items.length} item{items.length === 1 ? '' : 's'} ·{' '}
          <ThemedText type="statInline" themeColor="onPrimary">
            {Math.round(totals.calories)}
          </ThemedText>{' '}
          cal
        </ThemedText>
      </Pressable>
    </View>
  );
}

function RecentFoodRow({ food, onPress }: { food: RecentFood; onPress: () => void }) {
  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      <View style={styles.resultText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {food.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {food.brand ? `${food.brand} · ` : ''}last time: {Math.round(food.grams)} g
        </ThemedText>
      </View>
      <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
    </Pressable>
  );
}

/** Two-option sliding pill toggle — same idiom as the tab bar's sliding indicator. */
function SlidingToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const optionWidth = useSharedValue(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useSharedValue(index);

  useEffect(() => {
    position.set(withTiming(index, { duration: Motion.base }));
  }, [index, position]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: optionWidth.get(),
    transform: [{ translateX: position.get() * optionWidth.get() }],
  }));

  return (
    <View
      style={styles.slidingTrack}
      onLayout={(e: LayoutChangeEvent) => optionWidth.set(e.nativeEvent.layout.width / options.length)}>
      <Animated.View style={[styles.slidingIndicator, indicatorStyle]} />
      {options.map((option) => (
        <Pressable key={option.value} style={styles.slidingOption} onPress={() => onChange(option.value)}>
          <ThemedText type="small" themeColor={option.value === value ? 'onPrimary' : 'textSecondary'}>
            {option.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Shared amount screen for search results, recent foods, and recipe-book
 * servings, so any of them can have their portion controlled exactly.
 * Weight-based sources (search/recent) scale by grams; recipes have no
 * reliable weight data, so they scale by (fractional) serving count instead.
 */
function AmountPanel({
  source,
  onBack,
  onLog,
}: {
  source: AmountSource;
  onBack: () => void;
  onLog: (result: { grams?: number; servings: number; macros: Macros }) => void;
}) {
  const isRecipe = source.kind === 'recipe';
  const parsedServingGrams = source.kind === 'weight' ? parseServingGrams(source.food.servingSize) : null;
  // Falls back to the default/last-used amount as "1 serving" when the food
  // has no explicit OFF serving size, so Servings mode is always available.
  const baseGrams = source.kind === 'weight' ? (parsedServingGrams ?? source.initialGrams) : 0;
  const perServing: Macros = isRecipe ? recipePerServing(source.recipe) : macrosForGrams(source.food, baseGrams);

  const [mode, setMode] = useState<AmountMode>('servings');
  const [servings, setServings] = useState(1);
  const [unit, setUnit] = useState<AmountUnit>('g');
  const [amountText, setAmountText] = useState(
    source.kind === 'weight' ? String(Math.round(source.initialGrams * 10) / 10) : '1',
  );

  let grams: number | undefined;
  let servingsLogged: number;
  let macros: Macros;

  if (source.kind === 'weight') {
    if (mode === 'servings') {
      servingsLogged = servings;
      grams = servings * baseGrams;
    } else {
      const amount = Number(amountText) || 0;
      grams = unit === 'g' ? amount : ouncesToGrams(amount);
      servingsLogged = baseGrams > 0 ? grams / baseGrams : 0;
    }
    macros = macrosForGrams(source.food, grams);
  } else {
    servingsLogged = mode === 'servings' ? servings : Number(amountText) || 0;
    macros = scaleMacros(perServing, servingsLogged);
  }

  const canLog = source.kind === 'weight' ? (grams ?? 0) > 0 : servingsLogged > 0;

  const switchUnit = (next: AmountUnit) => {
    if (source.kind !== 'weight' || next === unit) return;
    const amount = Number(amountText) || 0;
    const converted = next === 'g' ? ouncesToGrams(amount) : gramsToOunces(amount);
    setAmountText(String(Math.round(converted * 10) / 10));
    setUnit(next);
  };

  const name = source.kind === 'weight' ? source.food.name : source.recipe.name;
  const subtitle =
    source.kind === 'weight'
      ? [source.food.brand, source.food.servingSize ? `serving ${source.food.servingSize}` : undefined]
          .filter(Boolean)
          .join(' · ')
      : `Recipe · ${Math.round(perServing.calories)} cal / serving`;

  return (
    <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={onBack}>
        <SymbolView name="chevron.left" size={12} tintColor={colors.primaryLight} />
        <ThemedText type="small" style={{ color: colors.primaryLight }}>
          Back
        </ThemedText>
      </Pressable>

      <ThemedText type="heading">{name}</ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}

      <SlidingToggle
        options={[
          { value: 'servings' as const, label: 'Servings' },
          { value: 'custom' as const, label: 'Custom' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <ThemedView type="surface" style={styles.panelCard}>
        {mode === 'servings' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {source.kind === 'weight' ? `Servings (${Math.round(baseGrams)} g each)` : 'Servings'}
            </ThemedText>
            <View style={styles.servingStepper}>
              <Pressable hitSlop={6} onPress={() => setServings((s) => Math.max(1, s - 1))}>
                <SymbolView name="minus.circle" size={24} tintColor={colors.textSecondary} />
              </Pressable>
              <ThemedText type="heading">{servings}</ThemedText>
              <Pressable hitSlop={6} onPress={() => setServings((s) => s + 1)}>
                <SymbolView name="plus.circle" size={24} tintColor={colors.textSecondary} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {source.kind === 'weight' ? 'Amount' : 'Servings'}
            </ThemedText>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              {source.kind === 'weight' &&
                (['g', 'oz'] as AmountUnit[]).map((option) => (
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
          </>
        )}

        <View style={styles.macroPreview}>
          <PreviewStat value={macros.calories} label="cal" emphasized />
          <PreviewStat value={macros.proteinG} label="protein" unit="g" />
          <PreviewStat value={macros.carbsG} label="carbs" unit="g" />
          <PreviewStat value={macros.fatG} label="fat" unit="g" />
        </View>
      </ThemedView>

      <Pressable
        style={[styles.primaryButton, !canLog && styles.primaryButtonDisabled]}
        disabled={!canLog}
        onPress={() => {
          haptics.impact();
          onLog({
            grams: grams !== undefined ? Math.round(grams * 10) / 10 : undefined,
            servings: servingsLogged,
            macros,
          });
        }}>
        <ThemedText type="smallBold" style={styles.primaryButtonText}>
          Add to meal
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Reached via the "Log a recipe" trigger row, distinct from the inline RECIPE
 * BOOK section shown while browsing search results — this is the reliable,
 * always-reachable entry point (works with zero recipes, always offers
 * Create New Recipe) rather than a convenience shortcut.
 */
function RecipePickerPanel({
  recipes,
  onBack,
  onSelect,
}: {
  recipes: Recipe[];
  onBack: () => void;
  onSelect: (recipe: Recipe) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backRow} onPress={onBack}>
        <SymbolView name="chevron.left" size={12} tintColor={colors.primaryLight} />
        <ThemedText type="small" style={{ color: colors.primaryLight }}>
          Back to search
        </ThemedText>
      </Pressable>

      <ThemedText type="heading">Recipes</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Log a recipe you&apos;ve built, or create a new one.
      </ThemedText>

      <Pressable
        style={styles.createRecipeRow}
        onPress={() => {
          haptics.selection();
          router.push('/recipe/new');
        }}>
        <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
        <ThemedText type="small" style={{ color: colors.primaryLight }}>
          Create New Recipe
        </ThemedText>
      </Pressable>

      {recipes.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Build a recipe once, then log a serving in one tap.
        </ThemedText>
      ) : (
        <View style={styles.recipeSection}>
          {recipes.map((recipe) => (
            <RecipeSearchRow key={recipe.id} recipe={recipe} onPress={() => onSelect(recipe)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * A one-off hand-typed food. For anything eaten repeatedly a nutrition-only
 * recipe is the better home (it's reusable) — this is for the meal you'll
 * never log again, so nothing is saved beyond the log entry itself.
 */
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
        Enter the nutrients for the amount you ate. To reuse this later, save it as a nutrition-only
        recipe instead.
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
        <ThemedText type="smallBold" style={styles.primaryButtonText}>
          Add to meal
        </ThemedText>
      </Pressable>
    </ScrollView>
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

/**
 * One tier's results under a heading, collapsed to `previewCount` rows. Both
 * tiers over-fetch to give the ranker a deep pool, so both need the same
 * "show the rest" affordance. Renders nothing when the tier is empty.
 */
function ResultSection({
  label,
  results,
  previewCount,
  expanded,
  onExpand,
  onSelect,
}: {
  label: string;
  results: FoodSearchResult[];
  previewCount: number;
  expanded: boolean;
  onExpand: () => void;
  onSelect: (result: FoodSearchResult) => void;
}) {
  if (results.length === 0) return null;
  const visible = expanded ? results : results.slice(0, previewCount);
  const hidden = results.length - visible.length;

  return (
    <View style={styles.recipeSection}>
      <ThemedText type="label" style={styles.sectionLabel}>
        {label}
      </ThemedText>
      {visible.map((result) => (
        <ResultRow key={result.code} result={result} onPress={() => onSelect(result)} />
      ))}
      {hidden > 0 && (
        <Pressable
          style={styles.customRow}
          onPress={() => {
            haptics.selection();
            onExpand();
          }}>
          <SymbolView name="chevron.down" size={14} tintColor={colors.primaryLight} />
          <ThemedText type="small" style={{ color: colors.primaryLight }}>
            Show {hidden} more
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function ResultRow({ result, onPress }: { result: FoodSearchResult; onPress: () => void }) {
  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
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
  );
}

function RecipeSearchRow({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const perServing = recipePerServing(recipe);
  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      <View style={styles.resultText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {recipe.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {Math.round(perServing.calories)} cal / serving
        </ThemedText>
      </View>
      <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
    </Pressable>
  );
}

function PreviewStat({
  value,
  label,
  unit,
  emphasized,
}: {
  value: number;
  label: string;
  unit?: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.previewStat}>
      <ThemedText type={emphasized ? 'stat' : 'smallBold'} style={emphasized ? styles.previewEmphasis : undefined}>
        {Math.round(value)}
        {unit ?? ''}
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
  topTitle: {
    flexShrink: 1,
  },
  eventMeta: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  titleInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
  },
  tray: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  trayList: {
    maxHeight: 132,
  },
  trayListContent: {
    gap: Spacing.one,
  },
  trayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  trayButton: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  trayButtonPressed: {
    backgroundColor: colors.primaryDark,
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
  entryPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
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
  spinner: {
    paddingVertical: Spacing.three,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
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
  slidingTrack: {
    flexDirection: 'row',
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  slidingIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
  },
  slidingOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.surface,
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
  createRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  primaryButton: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
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
