import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ScheduleDaySelector } from '@/components/schedule-day-selector';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS } from '@/lib/activity-icons';
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
  const [hasTargetTime, setHasTargetTime] = useState(true);
  const [hasTargetDistance, setHasTargetDistance] = useState(existing?.targetDistanceMiles !== undefined);
  const [targetMinutes, setTargetMinutes] = useState(existing?.durationMinutes ?? 30);
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

          <ThemedText type="label" style={styles.sectionLabel}>
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
                  <SymbolView
                    name={ACTIVITY_ICONS[option]}
                    size={14}
                    tintColor={active ? colors.onPrimary : colors.textSecondary}
                  />
                  <ThemedText type="small" style={active ? { color: colors.onPrimary } : undefined}>
                    {ACTIVITY_LABELS[option]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="label" style={styles.sectionLabel}>
            TARGET
          </ThemedText>
          <View style={styles.targetKindRow}>
            <Pressable
              style={[styles.targetKindButton, hasTargetTime && styles.targetKindButtonActive]}
              onPress={() => setHasTargetTime((v) => !v)}>
              <SymbolView
                name="clock.fill"
                size={16}
                tintColor={hasTargetTime ? colors.onPrimary : colors.textSecondary}
              />
              <ThemedText type="smallBold" style={hasTargetTime ? { color: colors.onPrimary } : undefined}>
                Target Time
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.targetKindButton, hasTargetDistance && styles.targetKindButtonActive]}
              onPress={() => setHasTargetDistance((v) => !v)}>
              <SymbolView
                name="ruler.fill"
                size={16}
                tintColor={hasTargetDistance ? colors.onPrimary : colors.textSecondary}
              />
              <ThemedText type="smallBold" style={hasTargetDistance ? { color: colors.onPrimary } : undefined}>
                Target Distance
              </ThemedText>
            </Pressable>
          </View>

          {(hasTargetTime || hasTargetDistance) && (
            <ThemedView type="surface" style={styles.card}>
              {hasTargetTime && (
                <View style={styles.stepperRow}>
                  <Stepper
                    label="Target time"
                    value={targetMinutes}
                    min={5}
                    step={5}
                    suffix="min"
                    onChange={setTargetMinutes}
                  />
                </View>
              )}
              {hasTargetDistance && (
                <View style={[styles.stepperRow, hasTargetTime && styles.stepperRowDivider]}>
                  <Stepper
                    label="Target distance"
                    value={targetDistanceDisplay}
                    min={0.25}
                    step={0.25}
                    suffix={distanceUnitLabel(unitSystem)}
                    onChange={setTargetDistanceDisplay}
                  />
                </View>
              )}
            </ThemedView>
          )}

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
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  activityChipActive: {
    backgroundColor: colors.primary,
  },
  targetKindRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  targetKindButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  targetKindButtonActive: {
    backgroundColor: colors.primary,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
  },
  stepperRow: {
    paddingVertical: Spacing.three,
  },
  stepperRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
