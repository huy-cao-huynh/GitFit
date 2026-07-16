import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleIcon } from '@/components/google-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage } from '@/lib/auth-errors';
import { checkEmailExists } from '@/lib/check-email-exists';
import { toDateKey } from '@/lib/store/derive';
import { useAuth } from '@/providers/auth-provider';

type Step = 'email' | 'signin' | 'signup';

function defaultBirthday(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 25);
  return date;
}

export default function LoginScreen() {
  const theme = useTheme();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthday, setBirthday] = useState<Date>(defaultBirthday);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState<'primary' | 'google' | null>(null);

  const submit = async (action: 'primary' | 'google', run: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setPending(action);
    try {
      await run();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const handleContinue = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email to continue.');
      return;
    }
    submit('primary', async () => {
      const exists = await checkEmailExists(trimmed);
      setEmail(trimmed);
      setStep(exists ? 'signin' : 'signup');
    });
  };

  const handleSignIn = () => submit('primary', () => signInWithEmail(email, password));

  const handleCreateAccount = () => {
    if (!password) {
      setError('Enter a password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    submit('primary', async () => {
      const session = await signUpWithEmail(email, password, { birthday: toDateKey(birthday) });
      if (!session) {
        setInfo('Account created — check your email for a confirmation link, then sign in.');
      }
    });
  };

  const handleGoogle = () => submit('google', signInWithGoogle);

  const handleChangeEmail = () => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setBirthday(defaultBirthday());
    setError(null);
    setInfo(null);
  };

  const inputStyle = [styles.input, { backgroundColor: theme.surface, color: theme.text }];
  const isSubmitting = pending !== null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ThemedText type="subtitle" style={styles.title}>
              GitFit
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
              Sign in to track your workouts
            </ThemedText>

            <Field label="Email">
              {step === 'email' ? (
                <TextInput
                  style={inputStyle}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                />
              ) : (
                <View style={[styles.input, { backgroundColor: theme.surface }]}>
                  <ThemedText themeColor="textSecondary">{email}</ThemedText>
                </View>
              )}
            </Field>

            {step !== 'email' && (
              <Pressable onPress={handleChangeEmail} hitSlop={8} style={styles.changeEmail}>
                <ThemedText type="linkPrimary">Not you? Change email</ThemedText>
              </Pressable>
            )}

            {step === 'signin' && (
              <Field label="Password">
                <TextInput
                  style={inputStyle}
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  autoComplete="password"
                  secureTextEntry
                />
              </Field>
            )}

            {step === 'signup' && (
              <>
                <Field label="Password">
                  <TextInput
                    style={inputStyle}
                    placeholderTextColor={theme.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    autoComplete="new-password"
                    secureTextEntry
                  />
                </Field>
                <Field label="Confirm Password">
                  <TextInput
                    style={inputStyle}
                    placeholderTextColor={theme.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoComplete="new-password"
                    secureTextEntry
                  />
                </Field>
                <Field label="Birthday">
                  <View style={[styles.input, styles.birthdayBox, { backgroundColor: theme.surface }]}>
                    <DateTimePicker
                      value={birthday}
                      mode="date"
                      display="compact"
                      themeVariant="dark"
                      accentColor={Colors.primaryLight}
                      maximumDate={new Date()}
                      onChange={(_event, selected) => {
                        if (selected) setBirthday(selected);
                      }}
                    />
                  </View>
                </Field>
              </>
            )}

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}
            {info && (
              <ThemedText type="small" style={styles.info}>
                {info}
              </ThemedText>
            )}

            <PillButton
              label={step === 'email' ? 'Continue' : step === 'signin' ? 'Sign In' : 'Create Account'}
              onPress={step === 'email' ? handleContinue : step === 'signin' ? handleSignIn : handleCreateAccount}
              disabled={isSubmitting}
              loading={pending === 'primary'}
            />

            {step === 'email' && (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.divider}>
                  or
                </ThemedText>
                <PillButton
                  label="Continue with Google"
                  variant="google"
                  icon={<GoogleIcon size={18} />}
                  onPress={handleGoogle}
                  disabled={isSubmitting}
                  loading={pending === 'google'}
                />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
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

function PillButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'google';
  icon?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        variant === 'primary' ? styles.pillPrimary : styles.pillGoogle,
        pressed && styles.pillPressed,
        disabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={theme.text} />
      ) : (
        <>
          {icon}
          <ThemedText>{label}</ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four },
  flex: { flex: 1 },
  form: { flexGrow: 1, justifyContent: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  title: { textAlign: 'center' },
  field: { gap: Spacing.one },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  birthdayBox: { alignItems: 'flex-start' },
  changeEmail: { alignSelf: 'flex-start', marginTop: -Spacing.two },
  pill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  pillPrimary: { borderColor: Colors.primaryLight },
  pillGoogle: { borderColor: Colors.border },
  pillPressed: { borderColor: Colors.primaryLight, backgroundColor: Colors.primaryTint },
  divider: { textAlign: 'center' },
  disabled: { opacity: 0.5 },
  error: { color: Colors.danger, textAlign: 'center' },
  info: { color: Colors.success, textAlign: 'center' },
});
