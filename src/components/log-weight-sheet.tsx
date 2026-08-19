import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { UnitSystem } from '@/lib/store/types';
import { weightUnitLabel } from '@/lib/units';

const colors = Colors;

/**
 * Ad-hoc "log weight now" sheet, opened from the Progress tab's Weight tile.
 * Unlike WeighInCard (gated to the scheduled weekly weigh-in), this has no
 * date restriction — addBodyweight already upserts by date, so today's entry
 * can be logged or re-logged here any time.
 */
export function LogWeightSheet({
  visible,
  unitSystem,
  currentWeight,
  onSave,
  onClose,
}: {
  visible: boolean;
  unitSystem: UnitSystem;
  currentWeight: number | null;
  onSave: (displayValue: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {/* Mounted only while open, so its input state starts fresh from
          currentWeight each time rather than needing an effect to resync it. */}
      {visible && <LogWeightSheetForm unitSystem={unitSystem} currentWeight={currentWeight} onSave={onSave} onClose={onClose} />}
    </Modal>
  );
}

function LogWeightSheetForm({
  unitSystem,
  currentWeight,
  onSave,
  onClose,
}: {
  unitSystem: UnitSystem;
  currentWeight: number | null;
  onSave: (displayValue: number) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState(currentWeight ? String(currentWeight) : '');

  const save = () => {
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0) return;
    onSave(value);
    onClose();
  };

  return (
    <View style={styles.sheet}>
      <ThemedText type="smallBold">Log weight</ThemedText>
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
          autoFocus
          selectTextOnFocus
        />
        <ThemedText type="small" themeColor="textSecondary">
          {weightUnitLabel(unitSystem)}
        </ThemedText>
      </View>
      <Pressable style={styles.saveButton} onPress={save}>
        <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
          Save
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.three,
    color: colors.text,
    ...Type.statSm,
  },
  saveButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
});
