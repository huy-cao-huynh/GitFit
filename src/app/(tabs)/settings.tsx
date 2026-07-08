import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chevron } from '@/components/chevron';
import { GlowBackground } from '@/components/glow-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Destructive, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

export default function SettingsScreen() {
  const { session, signOut, updateProfile, updateEmail, updatePassword } = useAuth();
  const { goals } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const email = session?.user.email ?? '';
  const metadata = session?.user.user_metadata ?? {};
  const name = (metadata.full_name as string | undefined) ?? email.split('@')[0] ?? 'You';
  const birthday = (metadata.birthday as string | undefined) ?? '';

  const [draftName, setDraftName] = useState(name);
  const [draftBirthday, setDraftBirthday] = useState(birthday);
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftPassword, setDraftPassword] = useState('');

  const startEditing = () => {
    setDraftName(name);
    setDraftBirthday(birthday);
    setDraftEmail(email);
    setDraftPassword('');
    setError(null);
    setInfo(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      const messages: string[] = [];
      if (draftName.trim() !== name || draftBirthday.trim() !== birthday) {
        await updateProfile({ full_name: draftName.trim(), birthday: draftBirthday.trim() });
        messages.push('Profile updated.');
      }
      if (draftEmail.trim() && draftEmail.trim() !== email) {
        await updateEmail(draftEmail.trim());
        messages.push('Check both inboxes to confirm the email change.');
      }
      if (draftPassword) {
        await updatePassword(draftPassword);
        messages.push('Password changed.');
      }
      setInfo(messages.join(' ') || 'Nothing to save.');
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign out.');
    }
  };

  return (
    <View style={styles.container}>
      <GlowBackground variant="cool" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ThemedText type="subtitle">Profile</ThemedText>

            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <ThemedText type="subtitle" style={styles.avatarText}>
                  {name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="smallBold" style={styles.name}>
                  {name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {email}
                  {birthday ? ` · ${birthday}` : ''}
                </ThemedText>
              </View>
              {!isEditing && (
                <Pressable hitSlop={8} onPress={startEditing}>
                  <ThemedText type="small" style={{ color: colors.accent }}>
                    Edit
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {isEditing && (
              <ThemedView type="backgroundElement" style={styles.editCard}>
                <ProfileField label="Name" value={draftName} onChangeText={setDraftName} />
                <ProfileField
                  label="Birthday"
                  value={draftBirthday}
                  onChangeText={setDraftBirthday}
                  placeholder="YYYY-MM-DD"
                />
                <ProfileField
                  label="Email"
                  value={draftEmail}
                  onChangeText={setDraftEmail}
                  keyboardType="email-address"
                />
                <ProfileField
                  label="New password"
                  value={draftPassword}
                  onChangeText={setDraftPassword}
                  placeholder="Leave blank to keep"
                  secureTextEntry
                />
                <View style={styles.editButtons}>
                  <Pressable style={styles.secondaryButton} onPress={() => setIsEditing(false)}>
                    <ThemedText type="small">Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, isSaving && styles.disabled]}
                    disabled={isSaving}
                    onPress={handleSave}>
                    <ThemedText type="smallBold" style={{ color: colors.background }}>
                      {isSaving ? 'Saving…' : 'Save'}
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            )}

            {info && (
              <ThemedText type="small" style={styles.info}>
                {info}
              </ThemedText>
            )}

            <View>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                WEEKLY GOALS
              </ThemedText>
              <Pressable onPress={() => router.push('/goals')}>
                <ThemedView type="backgroundElement" style={styles.goalsCard}>
                  <GoalRow color={colors.accent} label="Calories" value={`${goals.calories} cal`} />
                  <GoalRow
                    color={colors.accentLight}
                    label="Workouts"
                    value={`${goals.workoutsPerWeek} / week`}
                    divider
                  />
                  <GoalRow color={colors.text} label="Cardio" value={`${goals.cardioMinutes} min`} divider />
                  <View style={[styles.goalRow, styles.goalRowDivider]}>
                    <ThemedText type="small" style={{ color: colors.accent }}>
                      Edit goals & daily check-offs
                    </ThemedText>
                    <Chevron color={colors.textSecondary} />
                  </View>
                </ThemedView>
              </Pressable>
            </View>

            <ThemedView type="backgroundElement" style={[styles.section, styles.row]}>
              <ThemedText type="small">Units</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                lbs / mi
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={[styles.section, styles.row]}>
              <View style={styles.rowText}>
                <ThemedText type="smallBold">Apple Health</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Coming soon — sync workouts and calories
                </ThemedText>
              </View>
              <Switch value={false} disabled />
            </ThemedView>

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <Pressable style={styles.logoutButton} onPress={handleSignOut}>
              <ThemedText style={styles.logoutText}>Log Out</ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ProfileField({
  label,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'email-address';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        style={styles.fieldInput}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        {...inputProps}
      />
    </View>
  );
}

function GoalRow({
  color,
  label,
  value,
  divider,
}: {
  color: string;
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.goalRow, divider && styles.goalRowDivider]}>
      <View style={styles.goalLabel}>
        <View style={[styles.goalDot, { backgroundColor: color }]} />
        <ThemedText type="small">{label}</ThemedText>
      </View>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.four,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.background,
    fontSize: 22,
    lineHeight: 26,
  },
  name: {
    fontSize: 17,
  },
  editCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  fieldInput: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.backgroundSelected,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  secondaryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  saveButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    backgroundColor: colors.accent,
  },
  disabled: {
    opacity: 0.6,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.two,
  },
  goalsCard: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  goalRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  section: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  logoutButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: Destructive,
  },
  logoutText: {
    color: '#ffffff',
  },
  info: {
    color: '#30a46c',
  },
  error: {
    color: Destructive,
    textAlign: 'center',
  },
});
