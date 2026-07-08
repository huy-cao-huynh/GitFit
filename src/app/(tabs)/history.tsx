import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Chevron } from '@/components/chevron';
import { GlowBackground } from '@/components/glow-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import type { Session } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const { sessions } = useStore();
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={styles.container}>
      <GlowBackground variant="cool" />
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          History
        </ThemedText>

        {sorted.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Your completed workouts will show up here.
          </ThemedText>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(entry) => entry.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <HistoryRow entry={item} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function HistoryRow({ entry }: { entry: Session }) {
  const setCount = entry.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

  return (
    <Pressable onPress={() => router.push(`/history/${entry.id}`)}>
      <ThemedView type="backgroundElement" style={styles.row}>
        <View style={styles.checkCircle}>
          <Svg width={14} height={11} viewBox="0 0 14 11">
            <Path
              d="M1 5.5l4 4 8-8"
              stroke={colors.background}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <View style={styles.rowText}>
          <ThemedText type="smallBold">{entry.routineName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(entry.date)} · {setCount} sets
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {entry.durationMinutes} min
        </ThemedText>
        <Chevron color={colors.textSecondary} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  title: {
    marginBottom: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
