import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
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
          <SymbolView name="calendar" size={16} tintColor={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">Schedule</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {mode === 'single'
              ? 'A one-off workout, not added to your recurring schedule.'
              : 'Pick the days this workout should appear as a TODO.'}
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
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: colors.backgroundElement,
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
    backgroundColor: colors.backgroundSelected,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    backgroundColor: colors.backgroundSelected,
    padding: Spacing.half,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modeButtonActive: {
    backgroundColor: colors.accent,
  },
  modeTextActive: {
    color: colors.background,
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
    backgroundColor: colors.backgroundSelected,
  },
  dayChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayTextActive: {
    color: colors.background,
  },
});
