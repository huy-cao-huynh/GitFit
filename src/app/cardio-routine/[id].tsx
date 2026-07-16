import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ScheduleDaySelector } from '@/components/schedule-day-selector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { makeId } from '@/lib/store/id';
import type { CardioActivityType, Routine, Weekday } from '@/lib/store/types';
import { distanceUnitLabel, fromDisplayDistance, toDisplayDistance } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

const ACTIVITY_TYPES: CardioActivityType[] = ['walk', 'run', 'hike', 'swim', 'cycle', 'sport', 'other'];
const ACTIVITY_LABELS: Record<CardioActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
  hike: 'Hike',
  swim: 'Swim',
  cycle: 'Cycle',
  sport: 'Sport',
  other: 'Other',
};

export default function CardioRoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, addRoutine, updateRoutine, deleteRoutine, preferences } = useStore();
  const unitSystem = preferences.unitSystem;

  const isNew = id === 'new';
  const existing = isNew ? undefined : routines.find((routine) => routine.id === id && routine.category === 'cardio');

  const [name, setName] = useState(existing?.name ?? '');
  const [activityType, setActivityType] = useState<CardioActivityType>(existing?.activityType ?? 'run');
  const [scheduledDays, setScheduledDays] = useState<Weekday[]>(existing?.scheduledDays ?? []);
  const [targetMinutes, setTargetMinutes] = useState(existing?.durationMinutes ?? 30);
  const [hasTargetDistance, setHasTargetDistance] = useState(existing?.targetDistanceMiles !== undefined);
  const [targetDistanceDisplay, setTargetDistanceDisplay] = useState(
    existing?.targetDistanceMiles ? toDisplayDistance(existing.targetDistanceMiles, unitSystem) : 2,
  );

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const routine: Routine = {
      id: existing?.id ?? makeId(),
      category: 'cardio',
      name: name.trim(),
      level: existing?.level ?? 'Custom',
      durationMinutes: targetMinutes,
      tileColor: existing?.tileColor ?? Colors.primaryTint,
      scheduledDays,
      exercises: [],
      activityType,
      targetDistanceMiles: hasTargetDistance ? fromDisplayDistance(targetDistanceDisplay, unitSystem) : undefined,
    };
    if (existing) {
      updateRoutine(routine);
    } else {
      addRoutine(routine);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    deleteRoutine(existing.id);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link" style={{ color: colors.primaryLight }}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{isNew ? 'New Cardio Workout' : 'Edit Cardio Workout'}</ThemedText>
          <Pressable onPress={handleSave} hitSlop={12} disabled={!canSave}>
            <ThemedText type="link" style={{ color: colors.primaryLight, opacity: canSave ? 1 : 0.4 }}>
              Save
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TextInput
            style={styles.nameInput}
            placeholder="Workout name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <ScheduleDaySelector selectedDays={scheduledDays} onChange={setScheduledDays} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            ACTIVITY
          </ThemedText>
          <View style={styles.activityGrid}>
            {ACTIVITY_TYPES.map((option) => {
              const active = activityType === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.activityChip, active && styles.activityChipActive]}
                  onPress={() => setActivityType(option)}>
                  <ThemedText type="small" style={active ? { color: colors.text } : undefined}>
                    {ACTIVITY_LABELS[option]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedView type="surface" style={styles.card}>
            <Stepper
              label="Target time"
              value={targetMinutes}
              min={5}
              step={5}
              suffix="min"
              onChange={setTargetMinutes}
            />
            <View style={[styles.distanceRow, styles.rowDivider]}>
              <Pressable style={styles.goalToggle} onPress={() => setHasTargetDistance((v) => !v)} hitSlop={6}>
                <View style={[styles.checkCircle, hasTargetDistance ? { backgroundColor: colors.primary } : styles.checkCircleOff]}>
                  {hasTargetDistance && <SymbolView name="checkmark" size={12} tintColor={colors.text} />}
                </View>
                <ThemedText type="small">Target distance</ThemedText>
              </Pressable>
              {hasTargetDistance && (
                <Stepper
                  label=""
                  value={targetDistanceDisplay}
                  min={0.25}
                  step={0.25}
                  suffix={distanceUnitLabel(unitSystem)}
                  onChange={setTargetDistanceDisplay}
                  compact
                />
              )}
            </View>
          </ThemedView>

          {existing && (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <ThemedText type="smallBold" style={styles.deleteText}>
                Delete Workout
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Stepper({
  label,
  value,
  min,
  step,
  suffix,
  onChange,
  compact,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.stepperCompact : styles.stepper}>
      {!!label && (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <View style={styles.stepperControls}>
        <Pressable hitSlop={6} style={styles.stepperButton} onPress={() => onChange(Math.max(min, round2(value - step)))}>
          <SymbolView name="minus" size={12} tintColor={colors.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.stepperValue}>
          {value}
          {suffix ? (
            <ThemedText type="small" themeColor="textSecondary">
              {' '}
              {suffix}
            </ThemedText>
          ) : null}
        </ThemedText>
        <Pressable hitSlop={6} style={styles.stepperButton} onPress={() => onChange(round2(value + step))}>
          <SymbolView name="plus" size={12} tintColor={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
    paddingTop: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  nameInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  activityChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  activityChipActive: {
    backgroundColor: colors.primary,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.three,
  },
  stepper: {
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  stepperCompact: {
    alignItems: 'center',
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
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 56,
    textAlign: 'center',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleOff: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  deleteButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: Spacing.three,
  },
  deleteText: {
    color: colors.danger,
  },
});
