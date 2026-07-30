import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardioSummary } from '@/components/cardio-summary';
import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS } from '@/lib/activity-icons';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function CardioHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cardioSessions, preferences } = useStore();
  const session = cardioSessions.find((s) => s.id === id);

  if (!session) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Workout not found</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="linkPrimary">Back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <SymbolView name="chevron.left" size={18} tintColor={colors.primaryLight} />
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(session.date)}
          </ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <SymbolView name={ACTIVITY_ICONS[session.activityType]} size={16} tintColor={colors.primaryLight} />
            <ThemedText type="subtitle">{session.name}</ThemedText>
          </View>

          <CardioSummary session={session} unitSystem={preferences.unitSystem} />
        </ScrollView>
      </SafeAreaView>
    </View>
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
    paddingTop: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
