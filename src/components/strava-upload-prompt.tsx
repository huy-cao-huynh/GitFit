import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { uploadToStrava, type UploadGitfitActivityType } from '@/lib/strava/client';
import { useStravaConnection } from '@/lib/strava/use-strava-connection';

type PromptState = 'prompt' | 'connecting' | 'uploading' | 'success' | 'failed' | 'dismissed';

/**
 * Self-contained "Upload to Strava?" card for a workout's finished screen --
 * no store coupling, mirroring PRCelebration's shape. Handles the connect
 * flow inline if the user isn't connected yet, then uploads and shows
 * progress/success/failure per the plan's UX spec. Renders null once
 * dismissed ("Not Now") or never shown again for this session.
 */
export function StravaUploadPrompt({
  gitfitActivityType,
  gitfitActivityId,
}: {
  gitfitActivityType: UploadGitfitActivityType;
  gitfitActivityId: string;
}) {
  const strava = useStravaConnection();
  const [state, setState] = useState<PromptState>('prompt');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  if (state === 'dismissed' || strava.isLoading) return null;

  const runUpload = async () => {
    setState('uploading');
    try {
      const result = await uploadToStrava({
        gitfitActivityType,
        gitfitActivityId,
        description: description.trim() || undefined,
      });
      if (result.status === 'uploaded') {
        setExternalUrl(result.externalUrl);
        setState('success');
        haptics.notification(Haptics.NotificationFeedbackType.Success);
      } else {
        setErrorMessage(result.error);
        setState('failed');
      }
    } catch {
      setErrorMessage(undefined);
      setState('failed');
    }
  };

  const handleUploadPress = async () => {
    if (!strava.connected) {
      setState('connecting');
      const result = await strava.connect();
      if (result !== 'connected') {
        setState('prompt');
        return;
      }
    }
    await runUpload();
  };

  if (state === 'success') {
    return (
      <ThemedView type="surface" style={styles.card}>
        <ThemedText type="smallBold" themeColor="primary">
          Uploaded to Strava ✓
        </ThemedText>
        {externalUrl && (
          <Pressable onPress={() => Linking.openURL(externalUrl)} hitSlop={8}>
            <ThemedText type="link" themeColor="primaryLight">
              View on Strava
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    );
  }

  if (state === 'failed') {
    return (
      <ThemedView type="surface" style={styles.card}>
        <ThemedText type="smallBold">Couldn&apos;t upload to Strava</ThemedText>
        {errorMessage && (
          <ThemedText type="small" themeColor="textSecondary">
            {errorMessage}
          </ThemedText>
        )}
        <View style={styles.row}>
          <Pressable style={styles.secondaryButton} onPress={runUpload}>
            <ThemedText type="smallBold" themeColor="primary">
              Retry
            </ThemedText>
          </Pressable>
          <Pressable style={styles.textButton} onPress={() => setState('dismissed')} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Not Now
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const isBusy = state === 'connecting' || state === 'uploading';

  return (
    <ThemedView type="surface" style={styles.card}>
      <ThemedText type="smallBold">Upload this workout to Strava?</ThemedText>
      <TextInput
        style={styles.descriptionInput}
        placeholder="Add a description (optional)"
        placeholderTextColor={Colors.textMuted}
        value={description}
        onChangeText={setDescription}
        editable={!isBusy}
        multiline
      />
      <View style={styles.row}>
        <Pressable style={[styles.primaryButton, isBusy && styles.disabled]} onPress={handleUploadPress} disabled={isBusy}>
          {isBusy ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Upload to Strava
            </ThemedText>
          )}
        </Pressable>
        <Pressable style={styles.textButton} onPress={() => setState('dismissed')} hitSlop={8} disabled={isBusy}>
          <ThemedText type="small" themeColor="textSecondary">
            Not Now
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  descriptionInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surfaceElevated,
    minHeight: 44,
  },
  primaryButton: {
    flex: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.onPrimary,
  },
  secondaryButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  textButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  disabled: {
    opacity: 0.6,
  },
});
