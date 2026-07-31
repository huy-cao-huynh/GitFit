import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SortableList } from '@/components/sortable-list';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { makeId } from '@/lib/store/id';
import type { ExerciseKind, RoutineSet, UnitSystem } from '@/lib/store/types';
import { clampToStep, formatStepperValue } from '@/lib/stepper-math';
import { fromDisplayWeight, toDisplayWeight, weightUnitLabel } from '@/lib/units';

const colors = Colors;
const ROW_HEIGHT = 52;
const DEFAULT_REPS = 8;

/**
 * Compact editable rows for a routine exercise's sets: tap-to-edit reps/
 * weight (or duration), drag-to-reorder, delete — plus separate Add Working
 * Set / Add Warm-up Set buttons (each duplicates the last set of its own
 * kind so repeated-weight sets are one tap, while still letting each row
 * diverge for pyramid sets) and a single rest stepper. Whether a set is a
 * warm-up is fixed by which Add button created it — there's no per-row
 * toggle. New warm-up sets are inserted after the last existing warm-up
 * (keeping all warm-ups before working sets) while new working sets append
 * to the end; drag-to-reorder can still override this. Used both in the
 * routine editor's Add/Edit Exercise sheet and the live session's
 * mid-workout quick-edit screen.
 */
export function ExerciseSetEditor({
  sets,
  onChangeSets,
  kind,
  restSec,
  onChangeRestSec,
  unitSystem,
}: {
  sets: RoutineSet[];
  onChangeSets: (sets: RoutineSet[]) => void;
  kind: ExerciseKind;
  restSec: number;
  onChangeRestSec: (restSec: number) => void;
  unitSystem: UnitSystem;
}) {
  const addSet = (isWarmup: boolean) => {
    const template = [...sets].reverse().find((set) => set.isWarmup === isWarmup) ?? sets[sets.length - 1];
    const next: RoutineSet = template
      ? { ...template, id: makeId(), isWarmup }
      : kind === 'time'
        ? { id: makeId(), isWarmup, durationSec: 30 }
        : { id: makeId(), isWarmup, reps: DEFAULT_REPS, weight: 0 };
    if (isWarmup) {
      const lastWarmupIndex = sets.reduce((last, set, index) => (set.isWarmup ? index : last), -1);
      const insertAt = lastWarmupIndex + 1;
      onChangeSets([...sets.slice(0, insertAt), next, ...sets.slice(insertAt)]);
    } else {
      onChangeSets([...sets, next]);
    }
  };

  const patchSet = (id: string, patch: Partial<RoutineSet>) => {
    onChangeSets(sets.map((set) => (set.id === id ? { ...set, ...patch } : set)));
  };

  const removeSet = (id: string) => {
    // No confirmation dialog on this delete — the haptic is the only
    // feedback the user gets that the tap registered and removed a row.
    haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onChangeSets(sets.filter((set) => set.id !== id));
  };

  const reorder = (orderedIds: string[]) => {
    const byId = new Map(sets.map((set) => [set.id, set]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter((set): set is RoutineSet => !!set);
    if (reordered.length === sets.length) onChangeSets(reordered);
  };

  return (
    <View style={styles.container}>
      {sets.length > 0 && (
        <SortableList
          items={sets}
          keyFor={(set) => set.id}
          rowHeight={ROW_HEIGHT}
          onOrderChange={reorder}
          renderRow={(set, dragHandle) => {
            const index = sets.findIndex((candidate) => candidate.id === set.id);
            const ordinal = sets.slice(0, index + 1).filter((candidate) => candidate.isWarmup === set.isWarmup).length;
            return (
              <SetRow
                set={set}
                ordinal={ordinal}
                kind={kind}
                unitSystem={unitSystem}
                onChange={(patch) => patchSet(set.id, patch)}
                onRemove={() => removeSet(set.id)}
                dragHandle={dragHandle}
              />
            );
          }}
        />
      )}

      <View style={styles.addRowGroup}>
        <Pressable style={styles.addRow} onPress={() => addSet(false)}>
          <SymbolView name="plus.circle.fill" size={18} tintColor={colors.primaryLight} />
          <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
            Add Working Set
          </ThemedText>
        </Pressable>
        <Pressable style={styles.addRow} onPress={() => addSet(true)}>
          <SymbolView name="plus.circle" size={18} tintColor={colors.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            Add Warm-up Set
          </ThemedText>
        </Pressable>
      </View>

      <Stepper label="Rest between sets" value={restSec} min={0} step={5} suffix="sec" onChange={onChangeRestSec} />
    </View>
  );
}

function SetRow({
  set,
  ordinal,
  kind,
  unitSystem,
  onChange,
  onRemove,
  dragHandle,
}: {
  set: RoutineSet;
  ordinal: number;
  kind: ExerciseKind;
  unitSystem: UnitSystem;
  onChange: (patch: Partial<RoutineSet>) => void;
  onRemove: () => void;
  dragHandle: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.setLabel}>
        <ThemedText
          type={set.isWarmup ? 'smallBold' : 'small'}
          themeColor={set.isWarmup ? 'primaryLight' : 'textSecondary'}>
          {set.isWarmup ? `Warm-up ${ordinal}` : `Set ${ordinal}`}
        </ThemedText>
      </View>

      {kind === 'time' ? (
        <EditableValue
          value={set.durationSec ?? 0}
          suffix="sec"
          min={5}
          step={5}
          onChange={(durationSec) => onChange({ durationSec })}
        />
      ) : (
        <View style={styles.repsWeightRow}>
          <EditableValue
            value={toDisplayWeight(set.weight ?? 0, unitSystem)}
            suffix={weightUnitLabel(unitSystem)}
            min={0}
            step={unitSystem === 'metric' ? 1 : 2.5}
            onChange={(displayWeight) => onChange({ weight: fromDisplayWeight(displayWeight, unitSystem) })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            ×
          </ThemedText>
          <EditableValue value={set.reps ?? 0} min={1} step={1} onChange={(reps) => onChange({ reps })} />
        </View>
      )}

      <Pressable hitSlop={8} onPress={onRemove}>
        <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
      </Pressable>
      {dragHandle}
    </View>
  );
}

function EditableValue({
  value,
  suffix,
  min,
  step,
  onChange,
}: {
  value: number;
  suffix?: string;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatStepperValue(value));
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editing) return;
    // See Stepper's identical fix: focusing after mount (instead of
    // autoFocus) lets selectTextOnFocus reliably highlight the old value.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onChange(clampToStep(parsed, min, Number.POSITIVE_INFINITY, step));
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        style={styles.valueInput}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
    );
  }

  return (
    <Pressable
      style={styles.valueButton}
      onPress={() => {
        setDraft(formatStepperValue(value));
        setEditing(true);
      }}>
      <ThemedText type="statInline">
        {formatStepperValue(value)}
        {suffix ? (
          <ThemedText type="small" themeColor="textSecondary">
            {' '}
            {suffix}
          </ThemedText>
        ) : null}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  setLabel: {
    minWidth: 76,
  },
  repsWeightRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  valueButton: {
    minWidth: 44,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  valueInput: {
    minWidth: 60,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  addRowGroup: {
    flexDirection: 'row',
  },
  addRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
