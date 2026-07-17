import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { WEEKDAY_OPTIONS } from '@/lib/store/derive';
import type { Weekday } from '@/lib/store/types';

const colors = Colors;

type ScheduleMode = 'single' | 'scheduled';

export function ScheduleDaySelector({
  selectedDays,
  onChange,
}: {
  selectedDays: Weekday[];
  onChange: (days: Weekday[]) => void;
}) {
  const [mode, setMode] = useState<ScheduleMode>(selectedDays.length > 0 ? 'scheduled' : 'single');

  const selectMode = (next: ScheduleMode) => {
    setMode(next);
    if (next === 'single') onChange([]);
  };

  const toggleDay = (day: Weekday) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((selected) => selected !== day)
      : [...selectedDays, day].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.icon}>
          <SymbolView name="calendar" size={16} tintColor={colors.primaryLight} />
        </View>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">Schedule</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {mode === 'single'
              ? 'A one-time workout.'
              : 'Schedule this workout for weekly reminders.'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.modeToggle}>
        <Pressable
          style={[styles.modeButton, mode === 'single' && styles.modeButtonActive]}
          onPress={() => selectMode('single')}>
          <ThemedText type="smallBold" style={mode === 'single' ? styles.modeTextActive : undefined}>
            Single Workout
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.modeButton, mode === 'scheduled' && styles.modeButtonActive]}
          onPress={() => selectMode('scheduled')}>
          <ThemedText type="smallBold" style={mode === 'scheduled' ? styles.modeTextActive : undefined}>
            Add to Schedule
          </ThemedText>
        </Pressable>
      </View>

      {mode === 'scheduled' && (
        <View style={styles.daysRow}>
          {WEEKDAY_OPTIONS.map((day) => {
            const active = selectedDays.includes(day.value);
            return (
              <Pressable
                key={day.value}
                accessibilityLabel={day.label}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => toggleDay(day.value)}>
                <ThemedText type="smallBold" style={active ? styles.dayTextActive : undefined}>
                  {day.short}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.half,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeTextActive: {
    color: colors.text,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayTextActive: {
    color: colors.text,
  },
});
