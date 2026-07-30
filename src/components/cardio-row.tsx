import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { RouteMap } from '@/components/route-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS } from '@/lib/activity-icons';
import type { CardioSession, UnitSystem } from '@/lib/store/types';
import { distanceUnitLabelForActivity, formatPace, toDisplayDistanceForActivity } from '@/lib/units';

const colors = Colors;
const THUMB_SIZE = 64;

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * One cardio session as a feed row: route thumbnail, name, date, and the three
 * numbers worth comparing at a glance. Shared by the Progress tab's recent
 * strip and the full runs list.
 */
export function CardioRow({ session, unitSystem }: { session: CardioSession; unitSystem: UnitSystem }) {
  const route = session.route ?? [];

  return (
    <Pressable onPress={() => router.push(`/history/cardio/${session.id}`)}>
      <ThemedView type="surface" style={styles.row}>
        {route.length > 1 ? (
          <View style={styles.thumb}>
            {/* Endpoint pins would swamp a line this small. */}
            <RouteMap route={route} height={THUMB_SIZE} showEndpoints={false} />
          </View>
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <SymbolView name={ACTIVITY_ICONS[session.activityType]} size={20} tintColor={colors.textSecondary} />
          </View>
        )}

        <View style={styles.body}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {session.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(session.date)}
          </ThemedText>
          <View style={styles.metaRow}>
            {session.distanceMiles ? (
              <ThemedText type="statInline">
                {toDisplayDistanceForActivity(session.distanceMiles, session.activityType, unitSystem)}{' '}
                {distanceUnitLabelForActivity(session.activityType, unitSystem)}
              </ThemedText>
            ) : null}
            <ThemedText type="statInline" themeColor="textSecondary">
              {session.minutes} min
            </ThemedText>
            {session.avgPaceSecPerMile ? (
              <ThemedText type="statInline" themeColor="textSecondary">
                {formatPace(session.avgPaceSecPerMile, unitSystem)}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <SymbolView name="chevron.right" size={12} tintColor={colors.textSecondary} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.two,
    paddingRight: Spacing.three,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
});
