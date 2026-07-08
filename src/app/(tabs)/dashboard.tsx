import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { ActivityRings } from '@/components/activity-rings';
import { Chevron } from '@/components/chevron';
import { GlowBackground } from '@/components/glow-background';
import { ThemedText } from '@/components/themed-text';
import { WeekStreak } from '@/components/week-streak';
import { BottomTabInset, Colors, MaxContentWidth, RingColors, Spacing } from '@/constants/theme';
import { todayKey, todayPlan, weeklyProgress, weekStreak } from '@/lib/store/derive';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

export default function DashboardScreen() {
  const { session } = useAuth();
  const { routines, sessions, goals, checkoffDefs, checkoffLog, toggleCheckoff } = useStore();
  const name = session?.user.email?.split('@')[0] ?? 'there';

  const week = weekStreak(sessions);
  const progress = weeklyProgress(sessions);
  const plan = todayPlan(routines, sessions);
  const today = todayKey();
  const doneToday = checkoffLog[today] ?? [];

  return (
    <View style={styles.container}>
      <GlowBackground variant="home" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Hey, {name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Ready to train?
            </ThemedText>
          </View>

          <WeekStreak days={week} />

          <Pressable style={styles.ringsArea} onPress={() => router.navigate('/workouts')}>
            <ActivityRings
              size={240}
              strokeWidth={16}
              gap={6}
              rings={[
                { progress: progress.calories / goals.calories, color: RingColors[0], trackColor: colors.backgroundSelected },
                { progress: progress.workoutsPerWeek / goals.workoutsPerWeek, color: RingColors[1], trackColor: colors.backgroundSelected },
                { progress: progress.cardioMinutes / goals.cardioMinutes, color: RingColors[2], trackColor: colors.backgroundSelected },
              ]}
            />
          </Pressable>

          <View style={styles.ringsLegend}>
            <LegendStat color={RingColors[0]} value={progress.calories} goal={goals.calories} label="cal" />
            <LegendStat color={RingColors[1]} value={progress.workoutsPerWeek} goal={goals.workoutsPerWeek} label="workouts" />
            <LegendStat color={RingColors[2]} value={progress.cardioMinutes} goal={goals.cardioMinutes} label="min cardio" />
          </View>

          <Pressable style={styles.startButton} onPress={() => router.push('/workout/choose')}>
            <Svg width={14} height={16} viewBox="0 0 14 16">
              <Path d="M0 0l14 8-14 8z" fill={colors.background} />
            </Svg>
            <ThemedText type="subtitle" style={styles.startButtonText}>
              Start Workout
            </ThemedText>
          </Pressable>

          <View style={styles.todaySection}>
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                TODAY
              </ThemedText>
              <Pressable hitSlop={8} onPress={() => router.push('/goals')}>
                <ThemedText type="small" style={{ color: colors.accent }}>
                  Edit
                </ThemedText>
              </Pressable>
            </View>

            {plan.status === 'completed' && (
              <View style={styles.todayRow}>
                <View style={[styles.todayIcon, { backgroundColor: colors.accent }]}>
                  <SymbolView name="checkmark" size={14} tintColor={colors.background} />
                </View>
                <View style={styles.todayText}>
                  <ThemedText type="smallBold">{plan.session.routineName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Completed · {plan.session.durationMinutes} min
                  </ThemedText>
                </View>
              </View>
            )}

            {plan.status === 'planned' && (
              <Pressable style={styles.todayRow} onPress={() => router.push(`/workout/${plan.routine.id}`)}>
                <View style={[styles.todayIcon, { backgroundColor: plan.routine.tileColor }]}>
                  <SymbolView name="dumbbell" size={15} tintColor={colors.accent} />
                </View>
                <View style={styles.todayText}>
                  <ThemedText type="smallBold">{plan.routine.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {plan.routine.durationMinutes} min · {plan.routine.level}
                  </ThemedText>
                </View>
                <Chevron color={colors.textSecondary} />
              </Pressable>
            )}

            {plan.status === 'rest' && (
              <View style={styles.todayRow}>
                <View style={[styles.todayIcon, { backgroundColor: colors.backgroundSelected }]}>
                  <SymbolView name="moon.zzz" size={15} tintColor={colors.accentLight} />
                </View>
                <View style={styles.todayText}>
                  <ThemedText type="smallBold">Rest day</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Recover — nothing planned
                  </ThemedText>
                </View>
              </View>
            )}

            {checkoffDefs.map((def) => {
              const done = doneToday.includes(def.id);
              return (
                <Pressable key={def.id} style={styles.todayRow} onPress={() => toggleCheckoff(today, def.id)}>
                  <View
                    style={[
                      styles.checkCircle,
                      done
                        ? { backgroundColor: colors.accent }
                        : { borderWidth: 2, borderColor: colors.backgroundSelected },
                    ]}>
                    {done && <SymbolView name="checkmark" size={12} tintColor={colors.background} />}
                  </View>
                  <ThemedText type="small" themeColor={done ? 'textSecondary' : 'text'} style={styles.checkLabel}>
                    {def.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LegendStat({ color, value, goal, label }: { color: string; value: number; goal: number; label: string }) {
  return (
    <View style={styles.legendStat}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="small">
        <ThemedText type="smallBold">{value}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          /{goal} {label}
        </ThemedText>
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  ringsArea: {
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  ringsLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  legendStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: Spacing.five,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  startButtonText: {
    color: colors.background,
    fontSize: 22,
    lineHeight: 28,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todaySection: {
    gap: Spacing.three,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  todayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    flex: 1,
    gap: Spacing.half,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
  },
});
