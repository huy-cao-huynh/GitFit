import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
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

import { ScreenBackground } from '@/components/screen-background';
import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { dateFromKey, toDateKey } from '@/lib/store/derive';
import { BUILTIN_GOAL_PRESETS } from '@/lib/store/goal-presets';
import { makeId } from '@/lib/store/id';
import { fromDisplayLength, lengthUnitLabel } from '@/lib/units';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type Sex = 'male' | 'female' | 'unset';
type Step = 'profile' | 'goals';

function defaultBirthday(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 25);
  return date;
}

/**
 * One-time post-signup step, gated in the root layout for any session
 * missing user_metadata.onboarded. Collects profile basics and a starter
 * set of weekly goals, then flips the flag — the root guard swaps to the
 * tabs stack on its own once the session refreshes, so there's no manual
 * navigation here.
 */
export default function OnboardingScreen() {
  const { session, updateProfile } = useAuth();
  const { goals, setGoals, preferences } = useStore();
  const metadata = session?.user.user_metadata ?? {};

  const [step, setStep] = useState<Step>('profile');
  const [name, setName] = useState((metadata.full_name as string | undefined) ?? '');
  const [sex, setSex] = useState<Sex>('unset');
  const [heightText, setHeightText] = useState('');
  const [birthday, setBirthday] = useState<Date>(() => {
    const existing = metadata.birthday as string | undefined;
    return existing ? dateFromKey(existing) : defaultBirthday();
  });
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMetric = (metric: string) => {
    haptics.selection();
    setSelectedMetrics((current) => {
      const next = new Set(current);
      if (next.has(metric)) next.delete(metric);
      else next.add(metric);
      return next;
    });
  };

  const canFinish = selectedMetrics.size > 0;

  const finish = async () => {
    setError(null);
    setSaving(true);
    try {
      const heightInches = heightText.trim()
        ? Math.round(fromDisplayLength(Number(heightText), preferences.unitSystem))
        : null;

      // Additive only, never a replace: an existing account (with real,
      // already-customized goals) can land here too, since the gate keys off
      // a metadata flag rather than "is this a brand-new signup".
      const chosen = BUILTIN_GOAL_PRESETS.filter((preset) => selectedMetrics.has(preset.metric));
      const existingMetrics = new Set(goals.map((goal) => goal.metric));
      const newGoals = chosen
        .filter((preset) => !existingMetrics.has(preset.metric))
        .map((preset) => ({ id: makeId(), ...preset }));
      if (newGoals.length > 0) setGoals([...goals, ...newGoals]);

      await updateProfile({
        full_name: name.trim(),
        sex,
        height_inches: heightInches ? String(heightInches) : '',
        birthday: toDateKey(birthday),
        onboarded: 'true',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your profile.');
      setSaving(false);
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {step === 'profile' ? (
              <>
                <ThemedText type="display">Welcome</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  A little about you, so GitFit can tailor your goals.
                </ThemedText>

                <Field label="Name">
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={colors.textSecondary}
                    value={name}
                    onChangeText={setName}
                  />
                </Field>

                <Field label="Sex">
                  <View style={styles.sexToggle}>
                    {(['male', 'female', 'unset'] as Sex[]).map((option) => {
                      const active = sex === option;
                      return (
                        <Pressable
                          key={option}
                          style={[styles.sexButton, active && styles.sexButtonActive]}
                          onPress={() => setSex(option)}>
                          <ThemedText type="small" style={active ? { color: colors.onPrimary } : undefined}>
                            {option === 'male' ? 'Male' : option === 'female' ? 'Female' : 'Skip'}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                <Field label={`Height (${lengthUnitLabel(preferences.unitSystem)})`}>
                  <TextInput
                    style={styles.input}
                    placeholder={preferences.unitSystem === 'metric' ? 'e.g. 178' : 'e.g. 70'}
                    placeholderTextColor={colors.textSecondary}
                    value={heightText}
                    onChangeText={setHeightText}
                    keyboardType="decimal-pad"
                  />
                </Field>

                <Field label="Birthday">
                  <View style={[styles.input, styles.birthdayBox]}>
                    <DateTimePicker
                      value={birthday}
                      mode="date"
                      display="compact"
                      themeVariant="dark"
                      accentColor={colors.primaryLight}
                      maximumDate={new Date()}
                      onValueChange={(_event, selected) => selected && setBirthday(selected)}
                    />
                  </View>
                </Field>

                <Pressable style={styles.primaryButton} onPress={() => setStep('goals')}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>
                    Continue
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <ThemedText type="display">Starter goals</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Pick a few to track — add or change these anytime from Log.
                </ThemedText>

                <View style={styles.goalChips}>
                  {BUILTIN_GOAL_PRESETS.map((preset) => {
                    const active = selectedMetrics.has(preset.metric);
                    return (
                      <Pressable
                        key={preset.metric}
                        style={[styles.goalChip, active && styles.goalChipActive]}
                        onPress={() => toggleMetric(preset.metric)}>
                        <ThemedText type="small" themeColor={active ? 'onPrimary' : 'textSecondary'}>
                          {preset.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>

                {error && (
                  <ThemedText type="small" style={styles.error}>
                    {error}
                  </ThemedText>
                )}

                <View style={styles.stepButtons}>
                  <Pressable style={styles.secondaryButton} onPress={() => setStep('profile')} disabled={saving}>
                    <ThemedText type="small">Back</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButton, styles.flex, (!canFinish || saving) && styles.disabled]}
                    disabled={!canFinish || saving}
                    onPress={finish}>
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {saving ? 'Saving…' : 'Finish'}
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    color: colors.text,
  },
  birthdayBox: {
    alignItems: 'flex-start',
  },
  sexToggle: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.half,
  },
  sexButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
  },
  sexButtonActive: {
    backgroundColor: colors.primary,
  },
  goalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  goalChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalChipActive: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
  },
  stepButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  secondaryButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  primaryButton: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.onPrimary,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: colors.danger,
  },
});
