import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ScheduleDaySelector } from '@/components/schedule-day-selector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS, ACTIVITY_LABELS, ACTIVITY_TYPES } from '@/lib/activity-icons';
import { haptics } from '@/lib/haptics';
import { makeId } from '@/lib/store/id';
import type { CardioActivityType, Routine, Weekday } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

export default function CardioRoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, addRoutine, updateRoutine, deleteRoutine } = useStore();
  const navigation = useNavigation();

  const isNew = id === 'new';
  const existing = isNew ? undefined : routines.find((routine) => routine.id === id && routine.category === 'cardio');

  const [name, setNameState] = useState(existing?.name ?? '');
  const [activityType, setActivityTypeState] = useState<CardioActivityType>(existing?.activityType ?? 'run');
  const [scheduledDays, setScheduledDaysState] = useState<Weekday[]>(existing?.scheduledDays ?? []);

  // Same dirty-guard shape as routine/[id].tsx — see the comment there for
  // why the swipe gesture is disabled rather than intercepted after the fact.
  const dirtyRef = useRef(false);
  const bypassPromptRef = useRef(false);
  const markDirty = () => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    navigation.setOptions({ gestureEnabled: false });
  };

  const setName = (value: string) => {
    setNameState(value);
    markDirty();
  };
  const setActivityType = (value: CardioActivityType) => {
    setActivityTypeState(value);
    markDirty();
  };
  const setScheduledDays = (value: Weekday[]) => {
    setScheduledDaysState(value);
    markDirty();
  };

  const canSave = name.trim().length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const routine: Routine = {
      id: existing?.id ?? makeId(),
      category: 'cardio',
      name: name.trim(),
      level: existing?.level ?? 'Custom',
      // Cardio has no target UI — this is a throwaway value, never surfaced.
      durationMinutes: existing?.durationMinutes ?? 0,
      tileColor: existing?.tileColor ?? Colors.primaryTint,
      scheduledDays,
      exercises: [],
      activityType,
    };
    bypassPromptRef.current = true;
    haptics.notification(Haptics.NotificationFeedbackType.Success);
    if (existing) {
      updateRoutine(routine);
    } else {
      addRoutine(routine);
    }
    router.back();
  }, [canSave, existing, name, scheduledDays, activityType, addRoutine, updateRoutine]);

  const handleDelete = () => {
    if (!existing) return;
    bypassPromptRef.current = true;
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    deleteRoutine(existing.id);
    router.back();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || bypassPromptRef.current) return;
      e.preventDefault();
      const discard = () => {
        bypassPromptRef.current = true;
        navigation.dispatch(e.data.action);
      };
      const buttons = canSave
        ? [
            { text: 'Keep Editing', style: 'cancel' as const },
            { text: 'Save', onPress: handleSave },
            { text: 'Discard', style: 'destructive' as const, onPress: discard },
          ]
        : [
            { text: 'Keep Editing', style: 'cancel' as const },
            { text: 'Discard', style: 'destructive' as const, onPress: discard },
          ];
      Alert.alert('Discard changes?', 'You have unsaved changes to this workout.', buttons);
    });
    return unsubscribe;
  }, [navigation, canSave, handleSave]);

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
