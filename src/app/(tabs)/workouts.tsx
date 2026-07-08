import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { Chevron } from '@/components/chevron';
import { GlowBackground } from '@/components/glow-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import type { Routine } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

export default function WorkoutsScreen() {
  const { routines } = useStore();

  return (
    <View style={styles.container}>
      <GlowBackground variant="cool" />
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Workouts
        </ThemedText>

        <FlatList
          data={routines}
          keyExtractor={(routine) => routine.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable style={styles.createRow} onPress={() => router.push('/routine/new')}>
              <View style={styles.createIcon}>
                <SymbolView name="plus" size={16} tintColor={colors.background} />
              </View>
              <ThemedText type="smallBold" style={{ color: colors.accent }}>
                New Workout
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item }) => <RoutineRow routine={item} />}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              Create a workout to get started.
            </ThemedText>
          }
        />
      </SafeAreaView>
    </View>
  );
}

function RoutineRow({ routine }: { routine: Routine }) {
  return (
    <Pressable onPress={() => router.push(`/routine/${routine.id}`)}>
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
        <Pressable hitSlop={8} style={styles.playButton} onPress={() => router.push(`/workout/${routine.id}`)}>
          <Svg width={12} height={14} viewBox="0 0 14 16">
            <Path d="M0 0l14 8-14 8z" fill={colors.background} />
          </Svg>
        </Pressable>
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
    paddingBottom: BottomTabInset,
  },
  title: {
    marginBottom: Spacing.three,
  },
  list: {
    gap: Spacing.two,
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
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
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
    marginBottom: Spacing.two,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
