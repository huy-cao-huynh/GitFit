import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { DEFAULT_NUTRITION_GOALS } from '@/lib/store/derive';
import { clampToStep, formatStepperValue } from '@/lib/stepper-math';
import type { NutritionGoals } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

/**
 * Full-page daily-targets editor, replacing the old inline dropdown on the
 * summary card. Edits are local until Save so Cancel genuinely discards them.
 */
export default function NutritionGoalsScreen() {
  const { nutritionGoals, setNutritionGoals } = useStore();
  const [draft, setDraft] = useState<NutritionGoals>(nutritionGoals ?? DEFAULT_NUTRITION_GOALS);

  const updateDraft = (patch: Partial<NutritionGoals>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const save = () => {
    setNutritionGoals(draft);
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
          <ThemedText type="smallBold">Daily Targets</ThemedText>
          <Pressable hitSlop={12} onPress={save}>
            <ThemedText type="linkPrimary">Save</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedView type="surface" style={styles.card}>
            <GoalRow
              label="Calories"
              value={draft.calories}
              min={800}
              max={8000}
              step={50}
              onChange={(calories) => updateDraft({ calories })}
            />
            <GoalRow
              label="Protein"
              value={draft.proteinG}
              min={0}
              max={500}
              step={5}
              suffix="g"
              divider
              onChange={(proteinG) => updateDraft({ proteinG })}
            />
            <GoalRow
              label="Carbs"
              value={draft.carbsG}
              min={0}
              max={800}
              step={5}
              suffix="g"
              divider
              onChange={(carbsG) => updateDraft({ carbsG })}
            />
            <GoalRow
              label="Fat"
              value={draft.fatG}
              min={0}
              max={300}
              step={5}
              suffix="g"
              divider
              onChange={(fatG) => updateDraft({ fatG })}
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * A hero-serif numeral flanked by +/- at the row's edges — leans into the
 * app's existing Fraunces stat-number voice instead of a compact stepper.
 * Tapping the number swaps it for a text input, same as `Stepper`.
 */
function GoalRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  divider,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  suffix?: string;
  divider?: boolean;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(formatStepperValue(value));
  const inputRef = useRef<TextInput>(null);

  // The value display stays mounted the whole time (see below) so its
  // count-up animation always resumes from what's on screen; only focus
  // needs to be driven manually since a hidden-then-shown TextInput doesn't
  // retrigger `autoFocus`.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      onChange(clampToStep(parsed, min, max ?? Number.POSITIVE_INFINITY, step));
    }
    setEditing(false);
  };

  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <ThemedText type="label" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <View style={styles.rowControls}>
        <Pressable hitSlop={12} style={styles.rowButton} onPress={() => onChange(Math.max(min, value - step))}>
          <SymbolView name="minus" size={16} tintColor={colors.text} />
        </Pressable>

        {/* Both branches stay mounted — swapping via a ternary would remount
            AnimatedNumber and reset its internal "last shown" value to 0,
            making it recount from zero every time you finish typing. */}
        <View style={styles.valueSlot}>
          <TextInput
            ref={inputRef}
            style={[styles.valueInput, !editing && styles.hidden]}
            value={text}
            onChangeText={setText}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Pressable
            style={[styles.valueButton, editing && styles.hidden]}
            onPress={() => {
              setText(formatStepperValue(value));
              setEditing(true);
            }}>
            <View style={styles.valueRow}>
              <AnimatedNumber value={value} grouped duration={400} style={styles.value} />
              {suffix ? (
                <ThemedText type="heading" themeColor="textSecondary">
                  {suffix}
                </ThemedText>
              ) : null}
            </View>
          </Pressable>
        </View>

        <Pressable
          hitSlop={12}
          style={styles.rowButton}
          onPress={() => onChange(max !== undefined ? Math.min(max, value + step) : value + step)}>
          <SymbolView name="plus" size={16} tintColor={colors.text} />
        </Pressable>
      </View>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  content: {
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.four,
  },
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: {
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  rowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueSlot: {
    flex: 1,
  },
  valueButton: {
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  value: {
    ...Type.statLg,
    color: colors.text,
  },
  valueInput: {
    ...Type.statLg,
    textAlign: 'center',
    color: colors.text,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: Spacing.one,
  },
  hidden: {
    display: 'none',
  },
});
