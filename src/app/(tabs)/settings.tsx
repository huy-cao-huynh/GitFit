import DateTimePicker from '@react-native-community/datetimepicker';
import { isAuthError } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Radius, Spacing } from '@/constants/theme';
import { authErrorMessage } from '@/lib/auth-errors';
import { dateFromKey, toDateKey } from '@/lib/store/derive';
import { useResetScrollOnFocus } from '@/lib/use-reset-scroll-on-focus';
import { formatHeight, fromDisplayLength, lengthUnitLabel, toDisplayLength } from '@/lib/units';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';
import type { UnitSystem } from '@/lib/store/types';

const colors = Colors;

type Sex = 'male' | 'female' | 'unset';

function defaultBirthday(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 25);
  return date;
}

function parseBirthday(value: string): Date {
  if (value) {
    // dateFromKey, not `new Date(value)` — the latter parses a bare
    // "YYYY-MM-DD" as UTC midnight, which rolls back a day in any timezone
    // behind UTC (exactly the "saved the 13th, shows the 12th" bug).
    const parsed = dateFromKey(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return defaultBirthday();
}

function formatBirthdayDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SettingsScreen() {
  const { session, signOut, updateProfile, updateEmail, updatePassword } = useAuth();
  const { preferences, setPreferences } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useResetScrollOnFocus<ScrollView>();

  const email = session?.user.email ?? '';
  const metadata = session?.user.user_metadata ?? {};
  const name = (metadata.full_name as string | undefined) ?? email.split('@')[0] ?? 'You';
  const birthday = (metadata.birthday as string | undefined) ?? '';
  const avatarUrl = (metadata.avatar_url as string | undefined) ?? '';
  const heightInches = Number(metadata.height_inches as string | undefined) || null;
  const sex = ((metadata.sex as string | undefined) ?? 'unset') as Sex;

  const [draftName, setDraftName] = useState(name);
  const [draftBirthday, setDraftBirthday] = useState(() => parseBirthday(birthday));
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftHeight, setDraftHeight] = useState(
    heightInches ? String(toDisplayLength(heightInches, preferences.unitSystem)) : '',
  );
  const [draftSex, setDraftSex] = useState<Sex>(sex);
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwCurrentPassword, setPwCurrentPassword] = useState('');
  const [pwNewPassword, setPwNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const startEditing = () => {
    setDraftName(name);
    setDraftBirthday(parseBirthday(birthday));
    setDraftEmail(email);
    setDraftHeight(heightInches ? String(toDisplayLength(heightInches, preferences.unitSystem)) : '');
    setDraftSex(sex);
    setError(null);
    setInfo(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setError(null);
    setInfo(null);

    const draftBirthdayKey = toDateKey(draftBirthday);
    setIsSaving(true);
    try {
      const messages: string[] = [];
      const draftHeightInches = draftHeight.trim()
        ? Math.round(fromDisplayLength(Number(draftHeight), preferences.unitSystem))
        : null;
      if (
        draftName.trim() !== name ||
        draftBirthdayKey !== birthday ||
        draftHeightInches !== heightInches ||
        draftSex !== sex
      ) {
        await updateProfile({
          full_name: draftName.trim(),
          birthday: draftBirthdayKey,
          avatar_url: avatarUrl,
          height_inches: draftHeightInches ? String(draftHeightInches) : '',
          sex: draftSex,
        });
        messages.push('Profile updated.');
      }
      if (draftEmail.trim() && draftEmail.trim() !== email) {
        await updateEmail(draftEmail.trim());
        messages.push('Check both inboxes to confirm the email change.');
      }
      setInfo(messages.join(' ') || 'Nothing to save.');
      setIsEditing(false);
    } catch (e) {
      // Supabase errors get the friendly mapping; our own client-side
      // validation throws (e.g. "new password must differ") are already
      // user-facing copy and should pass through as-is.
      setError(isAuthError(e) ? authErrorMessage(e) : e instanceof Error ? e.message : 'Failed to save profile.');
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

  const openPasswordModal = () => {
    setPwCurrentPassword('');
    setPwNewPassword('');
    setPwError(null);
    setShowPasswordModal(true);
  };

  const handleChangePassword = async () => {
    setPwError(null);
    if (!pwCurrentPassword || !pwNewPassword) {
      setPwError('Enter your current and new password.');
      return;
    }
    setPwSaving(true);
    try {
      await updatePassword(pwCurrentPassword, pwNewPassword);
      setShowPasswordModal(false);
      setInfo('Password changed.');
    } catch (e) {
      setPwError(isAuthError(e) ? authErrorMessage(e) : e instanceof Error ? e.message : 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ThemedText type="subtitle">Profile</ThemedText>

            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <ThemedText type="subtitle" style={styles.avatarText}>
                    {name.charAt(0).toUpperCase()}
                  </ThemedText>
                )}
              </View>
              <View style={styles.flex}>
                <ThemedText type="smallBold" style={styles.name}>
                  {name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {email}
                  {birthday ? ` · ${birthday}` : ''}
                  {heightInches ? ` · ${formatHeight(heightInches, preferences.unitSystem)}` : ''}
                </ThemedText>
              </View>
              {!isEditing && (
                <Pressable hitSlop={8} onPress={startEditing}>
                  <ThemedText type="small" style={{ color: colors.primaryLight }}>
                    Edit
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {isEditing && (
              <ThemedView type="surface" style={styles.editCard}>
                <ProfileField label="Name" value={draftName} onChangeText={setDraftName} />
                <View style={styles.field}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Birthday
                  </ThemedText>
                  <Pressable style={styles.birthdayField} onPress={() => setBirthdayPickerOpen(true)}>
                    <ThemedText type="small">{formatBirthdayDisplay(draftBirthday)}</ThemedText>
                  </Pressable>
                </View>
                <ProfileField
                  label={`Height (${lengthUnitLabel(preferences.unitSystem)})`}
                  value={draftHeight}
                  onChangeText={setDraftHeight}
                  placeholder={preferences.unitSystem === 'metric' ? 'e.g. 178' : 'e.g. 70'}
                  keyboardType="decimal-pad"
                />
                <View style={styles.field}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Sex
                  </ThemedText>
                  <View style={styles.sexToggle}>
                    {(['male', 'female', 'unset'] as Sex[]).map((option) => {
                      const active = draftSex === option;
                      return (
                        <Pressable
                          key={option}
                          style={[styles.sexButton, active && styles.sexButtonActive]}
                          onPress={() => setDraftSex(option)}>
                          <ThemedText type="small" style={active ? { color: colors.onPrimary } : undefined}>
                            {option === 'male' ? 'Male' : option === 'female' ? 'Female' : 'Skip'}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <ProfileField
                  label="Email"
                  value={draftEmail}
                  onChangeText={setDraftEmail}
                  keyboardType="email-address"
                />
                <Pressable style={styles.changePasswordRow} onPress={openPasswordModal}>
                  <ThemedText type="small" style={{ color: colors.primaryLight }}>
                    Change Password
                  </ThemedText>
                </Pressable>
                <View style={styles.editButtons}>
                  <Pressable style={styles.secondaryButton} onPress={() => setIsEditing(false)}>
                    <ThemedText type="small">Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, isSaving && styles.disabled]}
                    disabled={isSaving}
                    onPress={handleSave}>
                    <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
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
              <ThemedText type="label" style={styles.sectionLabel}>
                UNITS
              </ThemedText>
              <ThemedView type="surface" style={[styles.section, styles.row]}>
                <ThemedText type="small">Measurement system</ThemedText>
                <UnitToggle value={preferences.unitSystem} onChange={(unitSystem) => setPreferences({ unitSystem })} />
              </ThemedView>
            </View>

            <ThemedView type="surface" style={[styles.section, styles.row]}>
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
      </ScreenBackground>

      <Modal
        transparent
        visible={birthdayPickerOpen}
        animationType="fade"
        onRequestClose={() => setBirthdayPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBirthdayPickerOpen(false)} />
        <View style={styles.bottomSheet}>
          <DateTimePicker
            value={draftBirthday}
            mode="date"
            display="spinner"
            themeVariant="dark"
            accentColor={colors.primaryLight}
            maximumDate={new Date()}
            onValueChange={(_event, selected) => setDraftBirthday(selected)}
          />
          <Pressable style={styles.sheetDoneButton} onPress={() => setBirthdayPickerOpen(false)}>
            <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
              Done
            </ThemedText>
          </Pressable>
        </View>
      </Modal>

      <Modal
        transparent
        visible={showPasswordModal}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPasswordModal(false)} />
        <View style={styles.bottomSheet}>
          <ThemedText type="smallBold">Change Password</ThemedText>
          <ProfileField
            label="Current password"
            value={pwCurrentPassword}
            onChangeText={setPwCurrentPassword}
            secureTextEntry
          />
          <ProfileField
            label="New password"
            value={pwNewPassword}
            onChangeText={setPwNewPassword}
            secureTextEntry
          />
          {pwError && (
            <ThemedText type="small" style={styles.error}>
              {pwError}
            </ThemedText>
          )}
          <View style={styles.editButtons}>
            <Pressable style={styles.secondaryButton} onPress={() => setShowPasswordModal(false)}>
              <ThemedText type="small">Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.saveButton, pwSaving && styles.disabled]}
              disabled={pwSaving}
              onPress={handleChangePassword}>
              <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
                {pwSaving ? 'Saving…' : 'Save'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </TabFadeView>
  );
}

function UnitToggle({ value, onChange }: { value: UnitSystem; onChange: (value: UnitSystem) => void }) {
  return (
    <View style={styles.unitToggle}>
      {(['imperial', 'metric'] as UnitSystem[]).map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            style={[styles.unitButton, active && styles.unitButtonActive]}
            onPress={() => onChange(option)}>
            <ThemedText type="small" style={active ? { color: colors.onPrimary } : undefined}>
              {option === 'imperial' ? 'lbs / mi' : 'kg / km'}
            </ThemedText>
          </Pressable>
        );
      })}
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
  keyboardType?: 'email-address' | 'url' | 'decimal-pad';
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.onPrimary,
    fontSize: 22,
    lineHeight: 26,
  },
  name: {
    fontSize: 17,
  },
  editCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  fieldInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  birthdayField: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: colors.surfaceElevated,
  },
  changePasswordRow: {
    paddingVertical: Spacing.one,
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
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: 0.6,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.half,
  },
  unitButton: {
    borderRadius: Radius.sm,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  unitButtonActive: {
    backgroundColor: colors.primary,
  },
  section: {
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
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
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: colors.danger,
  },
  logoutText: {
    color: colors.text,
  },
  info: {
    color: colors.success,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sheetDoneButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
});
