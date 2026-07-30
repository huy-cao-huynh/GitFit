import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardioRow } from '@/components/cardio-row';
import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

/** Every cardio session, newest first — the feed a run tracker is expected to have. */
export default function CardioHistoryListScreen() {
  const { cardioSessions, preferences } = useStore();
  const sorted = [...cardioSessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <SymbolView name="chevron.left" size={18} tintColor={colors.primaryLight} />
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            All activity
          </ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">Runs</ThemedText>

          {sorted.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No cardio sessions logged yet.
            </ThemedText>
          ) : (
            sorted.map((session) => (
              <CardioRow key={session.id} session={session} unitSystem={preferences.unitSystem} />
            ))
          )}
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
    width: '100%',
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
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
});
