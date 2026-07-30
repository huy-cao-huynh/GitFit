import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { BodyweightEntry, UnitSystem } from '@/lib/store/types';
import { formatWeight, weightUnitLabel } from '@/lib/units';

const colors = Colors;

/** Today's scheduled weigh-in — only rendered when today matches the Weigh In goal's chosen weekday. */
export function WeighInCard({
  loggedToday,
  unitSystem,
  onSave,
}: {
  loggedToday: BodyweightEntry | undefined;
  unitSystem: UnitSystem;
  onSave: (displayValue: number) => void;
}) {
  const [input, setInput] = useState('');

  const save = () => {
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0) return;
    onSave(value);
    setInput('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <SymbolView name="scalemass.fill" size={16} tintColor={colors.primaryLight} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold">Weigh In</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {loggedToday ? `Logged ${formatWeight(loggedToday.weight, unitSystem)}` : 'Scheduled for today'}
        </ThemedText>
      </View>
      {loggedToday ? (
        <View style={styles.doneCircle}>
          <SymbolView name="checkmark" size={12} tintColor={colors.onPrimary} />
        </View>
      ) : (
        <View style={styles.entryRow}>
          <TextInput
            style={styles.input}
            placeholder={weightUnitLabel(unitSystem)}
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            onSubmitEditing={save}
            returnKeyType="done"
          />
          <IconButton icon="checkmark.circle.fill" active={!!input.trim()} onPress={save} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    width: 72,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 14,
  },
});
