import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ContributionGrid } from '@/components/contribution-grid';
import { GlowBackground } from '@/components/glow-background';
import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeekStreak } from '@/components/week-streak';
import { BottomTabInset, Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { buildMonthCells } from '@/lib/calendar';
import {
  exerciseNames,
  plannedDates,
  strengthSeries,
  toDateKey,
  weekStreak,
} from '@/lib/store/derive';
import type { ProgressPoint } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type Range = 'week' | 'month' | 'year';
const RANGE_LABELS: Record<Range, string> = { week: 'Week', month: 'Month', year: 'Year' };

export default function ProgressScreen() {
  const { sessions, bodyweight, steps } = useStore();
  const [range, setRange] = useState<Range>('week');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);

  const names = exerciseNames(sessions);
  const exercise = selectedExercise ?? names[0];
  const strengthPoints = exercise ? strengthSeries(sessions, exercise) : [];
  const stepsPoints: ProgressPoint[] = steps.slice(-30).map((entry) => ({ date: entry.date, value: entry.steps }));
  const bodyweightPoints: ProgressPoint[] = bodyweight.map((entry) => ({ date: entry.date, value: entry.weight }));

  const chartWidth = contentWidth > 0 ? contentWidth - Spacing.three * 2 : 0;

  return (
    <View style={styles.container}>
      <GlowBackground variant="cool" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => setContentWidth(Math.min(event.nativeEvent.layout.width, MaxContentWidth) - Spacing.four * 2)}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Progress</ThemedText>
            <Dropdown
              label={RANGE_LABELS[range]}
              options={(['week', 'month', 'year'] as Range[]).map((r) => ({ id: r, label: RANGE_LABELS[r] }))}
              onSelect={(id) => setRange(id as Range)}
            />
          </View>

          {range === 'week' && <WeekStreak days={weekStreak(sessions)} size={36} />}
          {range === 'month' && <MonthGrid sessions={sessions} />}
          {range === 'year' && contentWidth > 0 && (
            <ContributionGrid sessions={sessions} width={contentWidth} />
          )}

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            TRACKING
          </ThemedText>

          {stepsPoints.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <StatHeader
                label="Steps"
                latest={`${stepsPoints[stepsPoints.length - 1].value.toLocaleString()}`}
                caption="last 30 days"
              />
              {chartWidth > 0 && <LineChart points={stepsPoints} width={chartWidth} color={Palette.yellow} />}
            </ThemedView>
          )}

          {bodyweightPoints.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <StatHeader
                label="Body weight"
                latest={`${bodyweightPoints[bodyweightPoints.length - 1].value} lbs`}
                caption={deltaCaption(bodyweightPoints, 'lbs')}
              />
              {chartWidth > 0 && <LineChart points={bodyweightPoints} width={chartWidth} color={Palette.periwinkle} />}
            </ThemedView>
          )}

          <View style={styles.strengthHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              STRENGTH
            </ThemedText>
            {names.length > 0 && (
              <Dropdown
                label={exercise ?? ''}
                options={names.map((name) => ({ id: name, label: name }))}
                onSelect={setSelectedExercise}
              />
            )}
          </View>

          {strengthPoints.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <StatHeader
                label={exercise!}
                latest={`${strengthPoints[strengthPoints.length - 1].value} lbs`}
                caption={deltaCaption(strengthPoints, 'lbs')}
              />
              {chartWidth > 0 && <LineChart points={strengthPoints} width={chartWidth} color={Palette.orange} />}
            </ThemedView>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Log workouts to see strength trends per movement.
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function deltaCaption(points: ProgressPoint[], unit: string): string {
  if (points.length < 2) return '';
  const delta = points[points.length - 1].value - points[0].value;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} ${unit}`;
}

function StatHeader({ label, latest, caption }: { label: string; latest: string; caption?: string }) {
  return (
    <View style={styles.statHeader}>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.statValue}>
          {latest}
        </ThemedText>
      </View>
      {caption ? (
        <ThemedText type="small" themeColor="textSecondary">
          {caption}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Dropdown({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.dropdown}>
      <Pressable style={styles.dropdownTrigger} onPress={() => setOpen((o) => !o)}>
        <ThemedText type="small">{label}</ThemedText>
        <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={11} tintColor={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdownMenu}>
          {options.map((option, index) => (
            <Pressable
              key={option.id}
              style={[styles.dropdownOption, index > 0 && styles.dropdownOptionDivider]}
              onPress={() => {
                onSelect(option.id);
                setOpen(false);
              }}>
              <ThemedText type="small" themeColor={option.label === label ? 'accent' : 'text'}>
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function MonthGrid({ sessions }: { sessions: { date: string }[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const completedDates = new Set(sessions.map((session) => session.date));
  const planned = plannedDates();
  const rows = buildMonthCells(year, month);
  const todaysKey = toDateKey(today);

  return (
    <View style={styles.monthGrid}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.monthLabel}>
        {monthLabel}
      </ThemedText>
      <View style={styles.weekdayRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <ThemedText key={index} type="small" themeColor="textSecondary" style={styles.weekdayLabel}>
            {label}
          </ThemedText>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.weekRow}>
          {row.map((day, dayIndex) => {
            if (day === null) return <View key={dayIndex} style={styles.dayCell} />;

            const dateKey = toDateKey(new Date(year, month, day));
            const isCompleted = completedDates.has(dateKey);
            const isPlanned = planned.has(dateKey);
            const isToday = dateKey === todaysKey;

            return (
              <View key={dayIndex} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayBubble,
                    isCompleted && { backgroundColor: colors.accent },
                    isPlanned && !isCompleted && styles.dayBubblePlanned,
                    isToday && !isCompleted && styles.dayBubbleToday,
                  ]}>
                  <ThemedText type="small" style={isCompleted ? styles.dayNumberCompleted : undefined}>
                    {day}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      ))}
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
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 26,
    lineHeight: 30,
  },
  dropdown: {
    position: 'relative',
    zIndex: 30,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    backgroundColor: colors.backgroundElement,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '110%',
    right: 0,
    minWidth: 160,
    borderRadius: Spacing.three,
    backgroundColor: '#1C1926',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dropdownOptionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  monthGrid: {
    gap: Spacing.one,
  },
  monthLabel: {
    marginBottom: Spacing.one,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubblePlanned: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  dayBubbleToday: {
    borderWidth: 2,
    borderColor: colors.accentLight,
  },
  dayNumberCompleted: {
    color: colors.background,
  },
});
