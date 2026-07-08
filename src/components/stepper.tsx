import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { clampToStep, formatStepperValue } from '@/lib/stepper-math';

const colors = Colors;

export function Stepper({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const currentValue = Number.isFinite(value) ? value : min;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatStepperValue(currentValue));

  const commitDraft = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      onChange(clampToStep(parsed, min, max ?? Number.POSITIVE_INFINITY, step));
    }
    setEditing(false);
  };

  return (
    <View style={styles.stepper}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.stepperControls}>
        <Pressable hitSlop={6} style={styles.stepperButton} onPress={() => onChange(Math.max(min, currentValue - step))}>
          <SymbolView name="minus" size={12} tintColor={colors.text} />
        </Pressable>
        {editing ? (
          <TextInput
            style={styles.stepperInput}
            value={draft}
            onChangeText={setDraft}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="decimal-pad"
            selectTextOnFocus
            autoFocus
          />
        ) : (
          <Pressable
            style={styles.stepperValueButton}
            onPress={() => {
              setDraft(formatStepperValue(currentValue));
              setEditing(true);
            }}>
            <ThemedText type="smallBold" style={styles.stepperValue}>
              {formatStepperValue(currentValue)}
              {suffix ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {' '}
                  {suffix}
                </ThemedText>
              ) : null}
            </ThemedText>
          </Pressable>
        )}
        <Pressable
          hitSlop={6}
          style={styles.stepperButton}
          onPress={() => onChange(max !== undefined ? Math.min(max, currentValue + step) : currentValue + step)}>
          <SymbolView name="plus" size={12} tintColor={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueButton: {
    minWidth: 44,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.one,
  },
  stepperValue: {
    minWidth: 44,
    textAlign: 'center',
  },
  stepperInput: {
    minWidth: 44,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: 0,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    backgroundColor: colors.backgroundSelected,
  },
});
