import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { makeId } from '@/lib/store/storage';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

export default function GoalsScreen() {
  const { goals, setGoals, checkoffDefs, setCheckoffDefs } = useStore();
  const [newCheckoff, setNewCheckoff] = useState('');

  const addCheckoff = () => {
    const name = newCheckoff.trim();
    if (!name) return;
    setCheckoffDefs([...checkoffDefs, { id: makeId(), name }]);
    setNewCheckoff('');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <ThemedText type="smallBold">Goals</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerSpacer}>
            <ThemedText type="link" style={styles.doneLink}>
              Done
            </ThemedText>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              WEEKLY TARGETS
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <GoalStepper
                label="Workouts"
                value={goals.workoutsPerWeek}
                unit="/ week"
                min={1}
                max={14}
                step={1}
                onChange={(workoutsPerWeek) => setGoals({ ...goals, workoutsPerWeek })}
              />
              <GoalStepper
                label="Calories"
                value={goals.calories}
                unit="cal"
                min={100}
                max={2000}
                step={50}
                divider
                onChange={(calories) => setGoals({ ...goals, calories })}
              />
              <GoalStepper
                label="Cardio"
                value={goals.cardioMinutes}
                unit="min"
                min={0}
                max={300}
                step={5}
                divider
                onChange={(cardioMinutes) => setGoals({ ...goals, cardioMinutes })}
              />
            </ThemedView>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              DAILY CHECK-OFFS
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              {checkoffDefs.map((def, index) => (
                <View key={def.id} style={[styles.checkoffRow, index > 0 && styles.rowDivider]}>
                  <ThemedText type="small" style={styles.flex}>
                    {def.name}
                  </ThemedText>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setCheckoffDefs(checkoffDefs.filter((d) => d.id !== def.id))}>
                    <SymbolView name="xmark.circle.fill" size={20} tintColor={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
              <View style={[styles.checkoffRow, checkoffDefs.length > 0 && styles.rowDivider]}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Add a daily goal (water, stretching…)"
                  placeholderTextColor={colors.textSecondary}
                  value={newCheckoff}
                  onChangeText={setNewCheckoff}
                  onSubmitEditing={addCheckoff}
                  returnKeyType="done"
                />
                <Pressable hitSlop={8} onPress={addCheckoff} disabled={!newCheckoff.trim()}>
                  <SymbolView
                    name="plus.circle.fill"
                    size={22}
                    tintColor={newCheckoff.trim() ? colors.accent : colors.backgroundSelected}
                  />
                </Pressable>
              </View>
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function GoalStepper({
  label,
  value,
  unit,
  min,
  max,
  step,
  divider,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  divider?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <View style={[styles.goalRow, divider && styles.rowDivider]}>
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
      <View style={styles.goalControls}>
        <Pressable
          hitSlop={6}
          style={styles.stepperButton}
          onPress={() => onChange(Math.max(min, value - step))}>
          <SymbolView name="minus" size={12} tintColor={colors.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.goalValue}>
          {value}
          <ThemedText type="small" themeColor="textSecondary">
            {' '}
            {unit}
          </ThemedText>
        </ThemedText>
        <Pressable
          hitSlop={6}
          style={styles.stepperButton}
          onPress={() => onChange(Math.min(max, value + step))}>
          <SymbolView name="plus" size={12} tintColor={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
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
  headerSpacer: {
    width: 44,
    alignItems: 'flex-end',
  },
  doneLink: {
    color: colors.accent,
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  goalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalValue: {
    minWidth: 88,
    textAlign: 'center',
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  addInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
});
