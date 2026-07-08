import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Destructive, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const theme = useTheme();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (action: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = () =>
    submit(async () => {
      const session = await signUpWithEmail(email.trim(), password);
      if (!session) {
        setInfo('Account created — check your email for a confirmation link, then sign in.');
      }
    });

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.form}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedText type="subtitle" style={styles.title}>
            GitFit
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
            Sign in to track your workouts
          </ThemedText>

          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            autoComplete="password"
            secureTextEntry
          />

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

          <Pressable
            style={[styles.button, { backgroundColor: theme.accent }, isSubmitting && styles.disabled]}
            disabled={isSubmitting}
            onPress={() => submit(() => signInWithEmail(email.trim(), password))}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Sign In</ThemedText>
            )}
          </Pressable>

          <Pressable
            style={[styles.button, { backgroundColor: theme.backgroundElement }, isSubmitting && styles.disabled]}
            disabled={isSubmitting}
            onPress={handleSignUp}>
            <ThemedText>Create Account</ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.divider}>
            or
          </ThemedText>

          <Pressable
            style={[styles.button, { backgroundColor: theme.backgroundElement }, isSubmitting && styles.disabled]}
            disabled={isSubmitting}
            onPress={() => submit(signInWithGoogle)}>
            <ThemedText>Continue with Google</ThemedText>
          </Pressable>
        </KeyboardAvoidingView>
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
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  divider: {
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: Destructive,
    textAlign: 'center',
  },
  info: {
    color: '#30a46c',
    textAlign: 'center',
  },
});
