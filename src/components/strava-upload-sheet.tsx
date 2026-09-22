import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { UnitSystem } from '@/lib/store/types';
import { uploadToStrava, type UploadGitfitActivityType } from '@/lib/strava/client';
import type { useStravaConnection } from '@/lib/strava/use-strava-connection';

type SheetState = 'idle' | 'connecting' | 'uploading' | 'failed';

/**
 * Page sheet behind the "Upload to Strava" button: an optional note, a
 * read-only preview of the description GitFit will post under it, and the
 * connect-if-needed + upload flow. Closes itself on success and hands the
 * activity URL back via `onUploaded`.
 */
export function StravaUploadSheet({
  visible,
  onClose,
  onUploaded,
  strava,
  gitfitActivityType,
  gitfitActivityId,
  preview,
  unitSystem,
}: {
  visible: boolean;
  onClose: () => void;
  onUploaded: (externalUrl: string | undefined) => void;
  strava: ReturnType<typeof useStravaConnection>;
  gitfitActivityType: UploadGitfitActivityType;
  gitfitActivityId: string;
  /** What GitFit posts beneath the note -- mirrors the server's formatter. */
  preview: string;
  unitSystem: UnitSystem;
}) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<SheetState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const isBusy = state === 'connecting' || state === 'uploading';

  const fail = (message: string | undefined) => {
    setErrorMessage(message ?? 'Something went wrong. Try again in a moment.');
    setState('failed');
  };

  const handleUpload = async () => {
    if (!strava.connected) {
      setState('connecting');
      const result = await strava.connect();
      if (result !== 'connected') {
        if (result === 'cancelled') setState('idle');
        else fail(result === 'denied' ? 'Strava access was declined.' : 'Couldn’t connect to Strava.');
        return;
      }
    }

    setState('uploading');
    setErrorMessage(undefined);
    try {
      const result = await uploadToStrava({
        gitfitActivityType,
        gitfitActivityId,
        description: note.trim() || undefined,
        unitSystem,
      });
      if (result.status === 'uploaded') {
        haptics.notification(Haptics.NotificationFeedbackType.Success);
        setState('idle');
        setNote('');
        onUploaded(result.externalUrl);
      } else {
        fail(result.status === 'not_connected' ? 'Strava is no longer connected.' : result.error);
      }
    } catch {
      fail(undefined);
    }
  };

  const buttonLabel = state === 'failed' ? 'Try Again' : strava.connected ? 'Upload' : 'Connect & Upload';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={isBusy ? undefined : onClose}>
      <View style={styles.container}>
        <SafeAreaView style={styles.flex} edges={['bottom']}>
          <KeyboardAvoidingView behavior="padding" style={styles.flex}>
            <View style={styles.header}>
              <ThemedText type="heading">Upload to Strava</ThemedText>
              <Pressable onPress={onClose} hitSlop={12} disabled={isBusy}>
                <ThemedText type="small" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (optional)"
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
                editable={!isBusy}
                multiline
              />

              <View style={styles.previewSection}>
                <ThemedText type="label" themeColor="textSecondary">
                  DESCRIPTION
                </ThemedText>
                <ThemedView type="surface" style={styles.previewCard}>
                  {note.trim() ? <ThemedText type="small">{note.trim()}</ThemedText> : null}
                  <ThemedText type="small">{preview}</ThemedText>
                </ThemedView>
                {gitfitActivityType === 'session' ? (
                  <ThemedText type="caption" themeColor="textSecondary">
                    Your sets go to Strava too, so it can show volume, reps and a muscle map.
                  </ThemedText>
                ) : null}
              </View>

              {state === 'failed' && errorMessage ? (
                <ThemedText type="small" themeColor="danger">
                  {errorMessage}
                </ThemedText>
              ) : null}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, isBusy && styles.disabled]}
              onPress={handleUpload}
              disabled={isBusy}>
              {isBusy ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <ThemedText type="button" themeColor="onPrimary">
                  {buttonLabel}
                </ThemedText>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  noteInput: {
    ...Type.body,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  previewSection: {
    gap: Spacing.two,
  },
  previewCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  primaryButton: {
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  primaryButtonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  disabled: {
    opacity: 0.6,
  },
});
