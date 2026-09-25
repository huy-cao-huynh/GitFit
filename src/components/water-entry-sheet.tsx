import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { UnitSystem, WaterEntry } from '@/lib/store/types';
import { fromDisplayVolume, toDisplayVolume, volumeUnitLabel } from '@/lib/units';

const colors = Colors;

/**
 * Edit one water entry from the Food timeline — its time and amount — or
 * delete it. Same bottom-sheet shape as LogWeightSheet.
 */
export function WaterEntrySheet({
  entry,
  unitSystem,
  onSave,
  onDelete,
  onClose,
}: {
  entry: WaterEntry | null;
  unitSystem: UnitSystem;
  onSave: (entry: WaterEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={entry !== null} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {/* Keyed on the entry so the form's drafts start fresh for each one. */}
      {entry && (
        <WaterEntryForm
          key={entry.id}
          entry={entry}
          unitSystem={unitSystem}
          onSave={onSave}
          onDelete={onDelete}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function WaterEntryForm({
  entry,
  unitSystem,
  onSave,
  onDelete,
  onClose,
}: {
  entry: WaterEntry;
  unitSystem: UnitSystem;
  onSave: (entry: WaterEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [loggedAt, setLoggedAt] = useState(entry.loggedAt);
  const [amount, setAmount] = useState(toDisplayVolume(Math.abs(entry.ounces), unitSystem));
  const step = unitSystem === 'metric' ? 50 : 2;

  const save = () => {
    const ounces = Math.round(fromDisplayVolume(amount, unitSystem));
    if (ounces <= 0) return;
    onSave({ ...entry, loggedAt, ounces: entry.ounces < 0 ? -ounces : ounces });
    onClose();
  };

  const remove = () => {
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    onDelete(entry.id);
    onClose();
  };

  return (
    <View style={styles.sheet}>
      <ThemedText type="smallBold">{entry.ounces < 0 ? 'Water correction' : 'Water'}</ThemedText>
      <TimeField date={entry.date} value={loggedAt} onChange={setLoggedAt} />
      <Stepper
        label="AMOUNT"
        value={amount}
        min={step}
        step={step}
        suffix={volumeUnitLabel(unitSystem)}
        onChange={setAmount}
      />
      <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]} onPress={save}>
        <ThemedText type="smallBold" themeColor="onPrimary">
          Save
        </ThemedText>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={remove}>
        <ThemedText type="smallBold" themeColor="danger">
          Delete
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
    // surface, not surfaceElevated — the stepper's raised controls sit on it.
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  saveButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
