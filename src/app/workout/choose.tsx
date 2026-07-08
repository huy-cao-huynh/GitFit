import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import type { Routine } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

export default function ChooseWorkoutScreen() {
  const { routines } = useStore();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ThemedText type="link" style={{ color: colors.accent }}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Choose a Workout</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={routines}
          keyExtractor={(routine) => routine.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable style={styles.createRow} onPress={() => router.push('/routine/new')}>
              <View style={styles.createIcon}>
                <ThemedText style={styles.createIconText}>+</ThemedText>
              </View>
              <ThemedText type="smallBold" style={{ color: colors.accent }}>
                Create New Workout
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item }) => <RoutineRow routine={item} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function RoutineRow({ routine }: { routine: Routine }) {
  return (
    <Pressable onPress={() => router.push(`/workout/${routine.id}`)}>
      <ThemedView type="backgroundElement" style={styles.routineCard}>
        <View style={[styles.routineIcon, { backgroundColor: routine.tileColor }]}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Rect x={3} y={3} width={14} height={14} rx={3} fill="none" stroke={colors.accent} strokeWidth={2} />
          </Svg>
        </View>
        <View style={styles.routineText}>
          <ThemedText type="smallBold">{routine.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {routine.exercises.length} exercises · {routine.durationMinutes} min
          </ThemedText>
        </View>
        <Chevron color={colors.backgroundSelected} />
      </ThemedView>
    </Pressable>
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
    paddingTop: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  headerSpacer: {
    width: 44,
  },
  list: {
    gap: Spacing.three,
  },
  createRow: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    borderRadius: Spacing.four,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconText: {
    color: '#ffffff',
    fontSize: 20,
  },
  routineCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  routineIcon: {
    width: 44,
    height: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineText: {
    flex: 1,
    gap: Spacing.half,
  },
});
