import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { searchFoods } from '@/lib/nutrition/usda-food-data-central';
import { macrosForGrams, type FoodSearchResult } from '@/lib/nutrition/units';
import { macroSummary, recipeTotals, scaleMacros } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { Macros, Recipe, RecipeEntryMode, RecipeIngredient } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const SEARCH_DEBOUNCE_MS = 400;

const colors = Colors;

/** Ingredient rows are edited as text drafts and parsed on save. */
interface IngredientDraft {
  id: string;
  name: string;
  grams: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

function toDraft(ingredient: RecipeIngredient): IngredientDraft {
  return {
    id: ingredient.id,
    name: ingredient.name,
    grams: ingredient.grams !== undefined ? String(ingredient.grams) : '',
    calories: String(ingredient.calories),
    proteinG: String(ingredient.proteinG),
    carbsG: String(ingredient.carbsG),
    fatG: String(ingredient.fatG),
  };
}

function emptyDraft(): IngredientDraft {
  return { id: makeId(), name: '', grams: '', calories: '', proteinG: '', carbsG: '', fatG: '' };
}

/** Scales a text macro value by `ratio`, rounded to `decimals` places. */
function scaleValue(value: string, ratio: number, decimals: number): string {
  const num = Number(value) || 0;
  const factor = 10 ** decimals;
  return String(Math.round(num * ratio * factor) / factor);
}

function fromDraft(draft: IngredientDraft): RecipeIngredient {
  return {
    id: draft.id,
    name: draft.name.trim(),
    grams: Number(draft.grams) > 0 ? Number(draft.grams) : undefined,
    calories: Number(draft.calories) || 0,
    proteinG: Number(draft.proteinG) || 0,
    carbsG: Number(draft.carbsG) || 0,
    fatG: Number(draft.fatG) || 0,
  };
}

/** The four numbers off a nutrition label, as text, for `macros` mode. */
type MacroDraft = Record<keyof Macros, string>;

function emptyMacroDraft(): MacroDraft {
  return { calories: '', proteinG: '', carbsG: '', fatG: '' };
}

function toMacroDraft(macros: Macros): MacroDraft {
  return {
    calories: String(macros.calories),
    proteinG: String(macros.proteinG),
    carbsG: String(macros.carbsG),
    fatG: String(macros.fatG),
  };
}

function fromMacroDraft(draft: MacroDraft): Macros {
  return {
    calories: Number(draft.calories) || 0,
    proteinG: Number(draft.proteinG) || 0,
    carbsG: Number(draft.carbsG) || 0,
    fatG: Number(draft.fatG) || 0,
  };
}

export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, addRecipe, updateRecipe, deleteRecipe } = useStore();
  const navigation = useNavigation();
  const isNew = id === 'new';
  const existing = isNew ? undefined : recipes.find((recipe) => recipe.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [servings, setServings] = useState(existing?.servings ?? 1);
  const [entryMode, setEntryMode] = useState<RecipeEntryMode>(existing?.entryMode ?? 'ingredients');
  // Starts empty — even a fresh manual row would be an "ingredient tab" open
  // before the user has chosen how to add one. The Add ingredient / Search
  // ingredient row below is the only way in.
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(existing?.ingredients.map(toDraft) ?? []);
  // Kept independently of `ingredients` so flipping the mode back and forth
  // never discards work the user already typed on the other side.
  const [labelDraft, setLabelDraft] = useState<MacroDraft>(
    existing?.perServing ? toMacroDraft(existing.perServing) : emptyMacroDraft(),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Dirty tracking is "touched at all," not deep-equality — good enough to
  // catch an accidental swipe-down after a real edit without the complexity
  // of diffing against the original. bypassPromptRef lets our own
  // Save/Discard navigate back without re-triggering the prompt. The swipe
  // gesture stays enabled (unlike the routine editor's dirty-tracking, which
  // disables it) — a swipe-down is exactly the case this prompt exists for,
  // so `beforeRemove` below has to actually see it, not have it silenced.
  const dirtyRef = useRef(false);
  const bypassPromptRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };

  const isMacroMode = entryMode === 'macros';
  const parsed = ingredients.map(fromDraft).filter((ingredient) => ingredient.name.length > 0);
  const labelMacros = fromMacroDraft(labelDraft);
  // One serving either way, so the summary card reads the same in both modes.
  const perServing = isMacroMode
    ? labelMacros
    : scaleMacros(
        recipeTotals({ id: '', name: '', servings: 1, entryMode: 'ingredients', ingredients: parsed }),
        1 / Math.max(1, servings),
      );
  const canSave =
    name.trim().length > 0 && (isMacroMode ? labelMacros.calories > 0 : parsed.length > 0);

  /**
   * Editing "Grams" on an already-added ingredient rescales the rest of its
   * macros by the same ratio, rather than leaving them pinned to whatever the
   * portion was when it was added — otherwise doubling the grams silently
   * kept the old calories/protein/carbs/fat.
   */
  const updateIngredient = (draftId: string, patch: Partial<IngredientDraft>) => {
    markDirty();
    setIngredients((current) =>
      current.map((draft) => {
        if (draft.id !== draftId) return draft;
        if (patch.grams === undefined) return { ...draft, ...patch };
        const previousGrams = Number(draft.grams);
        const nextGrams = Number(patch.grams);
        if (!(previousGrams > 0) || !(nextGrams > 0)) return { ...draft, ...patch };
        const ratio = nextGrams / previousGrams;
        return {
          ...draft,
          ...patch,
          calories: scaleValue(draft.calories, ratio, 0),
          proteinG: scaleValue(draft.proteinG, ratio, 1),
          carbsG: scaleValue(draft.carbsG, ratio, 1),
          fatG: scaleValue(draft.fatG, ratio, 1),
        };
      }),
    );
  };

  const save = useCallback(() => {
    haptics.notification(Haptics.NotificationFeedbackType.Success);
    const recipe: Recipe = {
      id: isNew ? makeId() : id!,
      name: name.trim(),
      // Macros mode describes a single serving, so the count is fixed at 1 —
      // quantity is chosen when logging instead.
      servings: isMacroMode ? 1 : servings,
      entryMode,
      perServing: isMacroMode ? labelMacros : undefined,
      ingredients: isMacroMode ? [] : parsed,
    };
    bypassPromptRef.current = true;
    if (isNew) addRecipe(recipe);
    else updateRecipe(recipe);
    router.back();
  }, [isNew, id, name, isMacroMode, servings, entryMode, labelMacros, parsed, addRecipe, updateRecipe]);

  const confirmDelete = () => {
    Alert.alert('Delete recipe?', 'Logged servings keep their nutrients.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.notification(Haptics.NotificationFeedbackType.Warning);
          bypassPromptRef.current = true;
          deleteRecipe(id!);
          router.back();
        },
      },
    ]);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || bypassPromptRef.current) return;
      e.preventDefault();
      const discard = () => {
        bypassPromptRef.current = true;
        navigation.dispatch(e.data.action);
      };
      const buttons = canSave
        ? [
            { text: 'Keep Editing', style: 'cancel' as const },
            { text: 'Save', onPress: save },
            { text: 'Discard', style: 'destructive' as const, onPress: discard },
          ]
        : [
            { text: 'Keep Editing', style: 'cancel' as const },
            { text: 'Discard', style: 'destructive' as const, onPress: discard },
          ];
      Alert.alert('Discard changes?', 'You have unsaved changes to this recipe.', buttons);
    });
    return unsubscribe;
  }, [navigation, canSave, save]);

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
            <ThemedText type="smallBold">{isNew ? 'New Recipe' : 'Edit Recipe'}</ThemedText>
            <Pressable hitSlop={12} disabled={!canSave} onPress={save}>
              <ThemedText type="linkPrimary" style={!canSave && styles.disabledLink}>
                Save
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <TextInput
              style={styles.nameInput}
              placeholder="Recipe name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={(text) => {
                setName(text);
                markDirty();
              }}
            />

            <View style={styles.modeToggle}>
              {(
                [
                  ['ingredients', 'Ingredients'],
                  ['macros', 'Nutrition only'],
                ] as const
              ).map(([mode, label]) => {
                const active = entryMode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[styles.modeButton, active && styles.modeButtonActive]}
                    onPress={() => {
                      haptics.selection();
                      setEntryMode(mode);
                      markDirty();
                    }}>
                    <ThemedText type="small" themeColor={active ? 'onPrimary' : 'textSecondary'}>
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedView type="surface" style={styles.card}>
              {isMacroMode ? (
                <View style={styles.perServing}>
                  <ThemedText type="smallBold">{Math.round(perServing.calories)} cal</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {macroSummary(perServing)} per serving
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.servingsRow}>
                  <Stepper
                    label="Servings"
                    value={servings}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(value) => {
                      setServings(value);
                      markDirty();
                    }}
                  />
                  <View style={styles.perServing}>
                    <ThemedText type="smallBold">{Math.round(perServing.calories)} cal</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {macroSummary(perServing)} per serving
                    </ThemedText>
                  </View>
                </View>
              )}
            </ThemedView>

            <ThemedText type="label" style={styles.sectionLabel}>
              {isMacroMode ? 'PER SERVING' : 'INGREDIENTS'}
            </ThemedText>

            {isMacroMode && (
              <ThemedView type="surface" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  Copy the numbers for one serving straight off the label. Log more than one serving when
                  you add it to a meal.
                </ThemedText>
                <View style={styles.macroGrid}>
                  <MacroInput
                    label="Cal"
                    value={labelDraft.calories}
                    onChangeText={(text) => {
                      setLabelDraft((current) => ({ ...current, calories: text }));
                      markDirty();
                    }}
                  />
                  <MacroInput
                    label="Protein"
                    value={labelDraft.proteinG}
                    onChangeText={(text) => {
                      setLabelDraft((current) => ({ ...current, proteinG: text }));
                      markDirty();
                    }}
                  />
                  <MacroInput
                    label="Carbs"
                    value={labelDraft.carbsG}
                    onChangeText={(text) => {
                      setLabelDraft((current) => ({ ...current, carbsG: text }));
                      markDirty();
                    }}
                  />
                  <MacroInput
                    label="Fat"
                    value={labelDraft.fatG}
                    onChangeText={(text) => {
                      setLabelDraft((current) => ({ ...current, fatG: text }));
                      markDirty();
                    }}
                  />
                </View>
              </ThemedView>
            )}

            {!isMacroMode && ingredients.map((draft) => (
              <ThemedView key={draft.id} type="surface" style={styles.card}>
                <View style={styles.ingredientHeader}>
                  <TextInput
                    style={[styles.textInput, styles.flex]}
                    placeholder="Ingredient name"
                    placeholderTextColor={colors.textSecondary}
                    value={draft.name}
                    onChangeText={(text) => updateIngredient(draft.id, { name: text })}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      haptics.selection();
                      setIngredients((current) => current.filter((candidate) => candidate.id !== draft.id));
                      markDirty();
                    }}>
                    <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.macroGrid}>
                  <MacroInput
                    label="Cal"
                    value={draft.calories}
                    onChangeText={(text) => updateIngredient(draft.id, { calories: text })}
                  />
                  <MacroInput
                    label="Grams"
                    value={draft.grams}
                    onChangeText={(text) => updateIngredient(draft.id, { grams: text })}
                  />
                  <MacroInput
                    label="Protein"
                    value={draft.proteinG}
                    onChangeText={(text) => updateIngredient(draft.id, { proteinG: text })}
                  />
                  <MacroInput
                    label="Carbs"
                    value={draft.carbsG}
                    onChangeText={(text) => updateIngredient(draft.id, { carbsG: text })}
                  />
                  <MacroInput
                    label="Fat"
                    value={draft.fatG}
                    onChangeText={(text) => updateIngredient(draft.id, { fatG: text })}
                  />
                </View>
              </ThemedView>
            ))}

            {isMacroMode ? null : pickerOpen ? (
              <IngredientPicker
                scrollViewRef={scrollViewRef}
                onAdd={(draft) => {
                  setIngredients((current) => [...current, draft]);
                  setPickerOpen(false);
                  markDirty();
                }}
                onCancel={() => setPickerOpen(false)}
              />
            ) : (
              <View style={styles.addIngredientRow}>
                <Pressable
                  style={styles.addRow}
                  onPress={() => {
                    haptics.selection();
                    setIngredients((current) => [...current, emptyDraft()]);
                    markDirty();
                  }}>
                  <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
                  <ThemedText type="small" style={{ color: colors.primaryLight }}>
                    Add ingredient
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.addRow}
                  onPress={() => {
                    haptics.selection();
                    setPickerOpen(true);
                  }}>
                  <SymbolView name="magnifyingglass.circle.fill" size={20} tintColor={colors.primaryLight} />
                  <ThemedText type="small" style={{ color: colors.primaryLight }}>
                    Search ingredient
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {!isNew && (
              <Pressable style={styles.deleteButton} onPress={confirmDelete}>
                <ThemedText type="smallBold" themeColor="danger">
                  Delete Recipe
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Search USDA FoodData Central for an ingredient and pick a gram amount, as an alternative to typing macros by hand. */
function IngredientPicker({
  onAdd,
  onCancel,
  scrollViewRef,
}: {
  onAdd: (draft: IngredientDraft) => void;
  onCancel: () => void;
  /** The recipe form's own ScrollView — the picker lives inline in it, so opening it or focusing its search field can leave the input riding under the keyboard unless we scroll it into view ourselves. */
  scrollViewRef: RefObject<ScrollView | null>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<FoodSearchResult | null>(null);
  const [gramsText, setGramsText] = useState('100');
  const abortRef = useRef<AbortController | null>(null);

  const scrollIntoView = () => {
    requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
  };

  // The picker card is the last thing in the form when it's open, so
  // bringing it (and the keyboard it's about to summon) into view on mount
  // is enough to keep the search field readable as the user types.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => scrollIntoView(), []);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(
      async () => {
        abortRef.current?.abort();
        if (trimmed.length < 2) {
          setResults([]);
          setSearching(false);
          return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setSearching(true);
        try {
          const found = await searchFoods(trimmed, controller.signal);
          if (!controller.signal.aborted) {
            setResults(found);
            setSearching(false);
          }
        } catch {
          if (!controller.signal.aborted) setSearching(false);
        }
      },
      trimmed.length < 2 ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query]);

  if (picked) {
    const grams = Number(gramsText) || 0;
    const macros = macrosForGrams(picked, grams);
    return (
      <ThemedView type="surface" style={styles.card}>
        <View style={styles.ingredientHeader}>
          <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
            {picked.name}
          </ThemedText>
          <Pressable hitSlop={8} onPress={() => setPicked(null)}>
            <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
          </Pressable>
        </View>
        <MacroInput label="Grams" value={gramsText} onChangeText={setGramsText} />
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(macros.calories)} cal · {Math.round(macros.proteinG)}p {Math.round(macros.carbsG)}c{' '}
          {Math.round(macros.fatG)}f
        </ThemedText>
        <Pressable
          style={[styles.pickerConfirmButton, grams <= 0 && styles.disabledButton]}
          disabled={grams <= 0}
          onPress={() => {
            haptics.selection();
            onAdd({
              id: makeId(),
              name: picked.name,
              grams: gramsText,
              calories: String(macros.calories),
              proteinG: String(macros.proteinG),
              carbsG: String(macros.carbsG),
              fatG: String(macros.fatG),
            });
          }}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            Add Ingredient
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="surface" style={styles.card}>
      <View style={styles.ingredientHeader}>
        <TextInput
          style={[styles.textInput, styles.flex]}
          placeholder="Search foods…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onFocus={scrollIntoView}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        <Pressable hitSlop={8} onPress={onCancel}>
          <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
        </Pressable>
      </View>
      {searching && <ActivityIndicator color={colors.primaryLight} />}
      {results.map((result) => (
        <Pressable key={result.code} style={styles.pickerResultRow} onPress={() => setPicked(result)}>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {result.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {result.brand ? `${result.brand} · ` : ''}
              {Math.round(result.caloriesPer100g)} cal / 100 g
            </ThemedText>
          </View>
          <SymbolView name="plus.circle.fill" size={18} tintColor={colors.primaryLight} />
        </Pressable>
      ))}
    </ThemedView>
  );
}

function MacroInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.macroInput}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
      />
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
  disabledLink: {
    opacity: 0.4,
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  nameInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: colors.text,
    fontSize: 16,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.half,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  perServing: {
    flex: 1,
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    marginTop: Spacing.two,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  macroInput: {
    flexGrow: 1,
    flexBasis: '30%',
    gap: Spacing.half,
  },
  textInput: {
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    color: colors.text,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  addIngredientRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  pickerResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerConfirmButton: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.onPrimary,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
