import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
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
import { recipeTotals, scaleMacros } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { RecipeIngredient } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

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

export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, addRecipe, updateRecipe, deleteRecipe } = useStore();
  const isNew = id === 'new';
  const existing = isNew ? undefined : recipes.find((recipe) => recipe.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [servings, setServings] = useState(existing?.servings ?? 1);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    existing ? existing.ingredients.map(toDraft) : [emptyDraft()],
  );

  const parsed = ingredients.map(fromDraft).filter((ingredient) => ingredient.name.length > 0);
  const totals = recipeTotals({ id: '', name: '', servings: 1, ingredients: parsed });
  const perServing = scaleMacros(totals, 1 / Math.max(1, servings));
  const canSave = name.trim().length > 0 && parsed.length > 0;

  const updateIngredient = (draftId: string, patch: Partial<IngredientDraft>) => {
    setIngredients((current) =>
      current.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft)),
    );
  };

  const save = () => {
    const recipe = { id: isNew ? makeId() : id!, name: name.trim(), servings, ingredients: parsed };
    if (isNew) addRecipe(recipe);
    else updateRecipe(recipe);
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Delete recipe?', 'Logged servings keep their nutrients.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRecipe(id!);
          router.back();
        },
      },
    ]);
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
            <ThemedText type="smallBold">{isNew ? 'New Recipe' : 'Edit Recipe'}</ThemedText>
            <Pressable hitSlop={12} disabled={!canSave} onPress={save}>
              <ThemedText type="linkPrimary" style={!canSave && styles.disabledLink}>
                Save
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <TextInput
              style={styles.nameInput}
              placeholder="Recipe name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <ThemedView type="surface" style={styles.card}>
              <View style={styles.servingsRow}>
                <Stepper label="Servings" value={servings} min={1} max={50} step={1} onChange={setServings} />
                <View style={styles.perServing}>
                  <ThemedText type="smallBold">{Math.round(perServing.calories)} cal</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {Math.round(perServing.proteinG)}p / {Math.round(perServing.carbsG)}c /{' '}
                    {Math.round(perServing.fatG)}f per serving
                  </ThemedText>
                </View>
              </View>
            </ThemedView>

            <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
              INGREDIENTS
            </ThemedText>

            {ingredients.map((draft) => (
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
                    onPress={() =>
                      setIngredients((current) => current.filter((candidate) => candidate.id !== draft.id))
                    }>
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

            <Pressable
              style={styles.addRow}
              onPress={() => setIngredients((current) => [...current, emptyDraft()])}>
              <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
              <ThemedText type="small" style={{ color: colors.primaryLight }}>
                Add ingredient
              </ThemedText>
            </Pressable>

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
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
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
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
