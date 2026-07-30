import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { MEAL_LABELS, MEAL_ORDER, scaleMacros } from '@/lib/store/derive';
import type { MealType } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

/**
 * Edit a logged food: change the meal, rescale the amount (macros scale
 * proportionally from the logged snapshot), or delete the entry.
 */
export default function FoodEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { foodLogs, updateFoodLog, deleteFoodLog } = useStore();
  const entry = foodLogs.find((candidate) => candidate.id === id);

  const [meal, setMeal] = useState<MealType>(entry?.meal ?? 'breakfast');
  const [gramsText, setGramsText] = useState(
    entry?.grams !== undefined ? String(Math.round(entry.grams * 10) / 10) : '',
  );

  if (!entry) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="small" themeColor="textSecondary">
            This entry no longer exists.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const grams = Number(gramsText) || 0;
  // Macros are a snapshot for the logged amount; scaling by grams ratio keeps
  // them consistent without needing the original per-100g source.
  const scaled =
    entry.grams !== undefined && entry.grams > 0 && grams > 0
      ? scaleMacros(entry, grams / entry.grams)
      : { calories: entry.calories, proteinG: entry.proteinG, carbsG: entry.carbsG, fatG: entry.fatG };

  const canSave = entry.grams === undefined || grams > 0;

  const save = () => {
    updateFoodLog({
      ...entry,
      meal,
      grams: entry.grams !== undefined ? grams : undefined,
      ...scaled,
    });
    router.back();
  };

  const remove = () => {
    deleteFoodLog(entry.id);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <ThemedText type="link" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.topTitle}>
            {entry.name}
          </ThemedText>
          <Pressable hitSlop={12} disabled={!canSave} onPress={save}>
            <ThemedText type="linkPrimary" style={!canSave && styles.disabledLink}>
              Save
            </ThemedText>
          </Pressable>
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

        <ThemedView type="surface" style={styles.card}>
          {entry.grams !== undefined ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Amount (g)
              </ThemedText>
              <TextInput
                style={styles.amountInput}
                value={gramsText}
                onChangeText={setGramsText}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Logged as a serving — macros below.
            </ThemedText>
          )}

          <View style={styles.macroPreview}>
            <PreviewStat value={scaled.calories} label="cal" />
            <PreviewStat value={scaled.proteinG} label="protein" unit="g" />
            <PreviewStat value={scaled.carbsG} label="carbs" unit="g" />
            <PreviewStat value={scaled.fatG} label="fat" unit="g" />
          </View>
        </ThemedView>

        <Pressable style={[styles.primaryButton, !canSave && styles.disabledButton]} disabled={!canSave} onPress={save}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            Save Changes
          </ThemedText>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={remove}>
          <ThemedText type="smallBold" themeColor="danger">
            Delete Entry
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function PreviewStat({ value, label, unit }: { value: number; label: string; unit?: string }) {
  return (
    <View style={styles.previewStat}>
      <ThemedText type="smallBold">
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
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
  },
  disabledLink: {
    opacity: 0.4,
  },
  mealChips: {
    flexDirection: 'row',
    gap: Spacing.two,
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
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  amountInput: {
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 18,
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
  primaryButton: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.three,
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
    paddingVertical: Spacing.two,
  },
});
