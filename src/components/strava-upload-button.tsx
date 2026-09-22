import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { StravaUploadSheet } from '@/components/strava-upload-sheet';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { stravaLinkFor } from '@/lib/store/derive';
import type { CardioSession, Session } from '@/lib/store/types';
import { buildCardioDescription, buildStrengthDescription } from '@/lib/strava/description';
import { useStravaConnection } from '@/lib/strava/use-strava-connection';
import { useStore } from '@/providers/store-provider';

type Props = (
  | { gitfitActivityType: 'session'; session: Session }
  | { gitfitActivityType: 'cardio_session'; session: CardioSession }
) & {
  /**
   * History screens pass this so a user who never connected Strava doesn't
   * see an upload button on every past workout. The finished screen doesn't:
   * it's where connecting inline makes sense.
   */
  hideWhenDisconnected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Footer-sized secondary action (border + lime text, no fill -- the lime
 * fill belongs to the screen's primary button) that opens the upload sheet,
 * then becomes "View on Strava" once the workout is there. Reads the upload
 * state from the store's Strava links, so it's correct on any screen.
 * Renders nothing for a workout imported *from* Strava.
 */
export function StravaUploadButton(props: Props) {
  const { gitfitActivityType, session, hideWhenDisconnected, style } = props;
  const { stravaActivities, preferences, recordStravaExport } = useStore();
  const strava = useStravaConnection();
  const [sheetOpen, setSheetOpen] = useState(false);

  const link = stravaLinkFor(stravaActivities, gitfitActivityType, session.id);
  if (link?.direction === 'import') return null;

  const uploaded = link?.uploadStatus === 'uploaded';
  if (!uploaded && hideWhenDisconnected && !strava.connected) return null;

  if (uploaded) {
    const externalUrl = link.externalUrl;
    return (
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
        onPress={externalUrl ? () => Linking.openURL(externalUrl) : undefined}
        disabled={!externalUrl}>
        <SymbolView name="checkmark.circle.fill" size={18} tintColor={Colors.primary} />
        <ThemedText type="button" themeColor="primary">
          {externalUrl ? 'View on Strava' : 'On Strava'}
        </ThemedText>
      </Pressable>
    );
  }

  const preview =
    props.gitfitActivityType === 'session'
      ? buildStrengthDescription(props.session, preferences.unitSystem)
      : buildCardioDescription(props.session);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
        onPress={() => setSheetOpen(true)}>
        <SymbolView name="square.and.arrow.up" size={18} tintColor={Colors.primary} />
        <ThemedText type="button" themeColor="primary">
          {link?.uploadStatus === 'failed' ? 'Retry Strava Upload' : 'Upload to Strava'}
        </ThemedText>
      </Pressable>

      <StravaUploadSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUploaded={(externalUrl) => {
          setSheetOpen(false);
          recordStravaExport({
            gitfitActivityType,
            gitfitActivityId: session.id,
            direction: 'export',
            uploadStatus: 'uploaded',
            externalUrl,
          });
        }}
        strava={strava}
        gitfitActivityType={gitfitActivityType}
        gitfitActivityId={session.id}
        preview={preview}
        unitSystem={preferences.unitSystem}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.three,
  },
  pressed: {
    backgroundColor: Colors.surfaceElevated,
  },
});
