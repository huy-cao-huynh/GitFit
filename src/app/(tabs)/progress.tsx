import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ContributionGrid } from '@/components/contribution-grid';
import { LineChart } from '@/components/line-chart';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ChartColors, Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { exerciseNames, strengthSeries, toDateKey } from '@/lib/store/derive';
import type { ProgressPoint } from '@/lib/store/types';
import { toDisplayVolume, toDisplayWeight, volumeUnitLabel, weightUnitLabel } from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type MetricRange = 'week' | 'month' | 'all';
const METRIC_RANGE_LABELS: Record<MetricRange, string> = { week: 'Week', month: 'Month', all: 'All time' };

export default function ProgressScreen() {
  const { sessions, cardioSessions, bodyweight, steps, waterEntries, preferences } = useStore();
  const unitSystem = preferences.unitSystem;
  const [metricRange, setMetricRange] = useState<MetricRange>('month');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);

  const names = exerciseNames(sessions);
  const exercise = selectedExercise ?? names[0];
  const strengthPoints = filterPoints(exercise ? strengthSeries(sessions, exercise) : [], metricRange).map((point) => ({
    ...point,
    value: toDisplayWeight(point.value, unitSystem),
  }));
  const stepsPoints: ProgressPoint[] = filterPoints(
    steps.map((entry) => ({ date: entry.date, value: entry.steps })),
    metricRange,
  );
  const bodyweightPoints: ProgressPoint[] = filterPoints(
    bodyweight.map((entry) => ({ date: entry.date, value: toDisplayWeight(entry.weight, unitSystem) })),
    metricRange,
  );
  const calorieSources = [
    ...sessions.map((s) => ({ date: s.date, calories: s.calories ?? 0 })),
    ...cardioSessions.map((s) => ({ date: s.date, calories: s.calories ?? 0 })),
  ];
  const caloriePoints = filterPoints(aggregateByDate(calorieSources, (entry) => entry.calories), metricRange);
  const cardioPoints = filterPoints(aggregateByDate(cardioSessions, (entry) => entry.minutes), metricRange);
  const waterPoints = filterPoints(aggregateByDate(waterEntries, (entry) => entry.ounces), metricRange).map((point) => ({
    ...point,
    value: toDisplayVolume(point.value, unitSystem),
  }));

  const chartWidth = contentWidth > 0 ? contentWidth - Spacing.three * 2 : 0;

  return (
    <TabFadeView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => setContentWidth(Math.min(event.nativeEvent.layout.width, MaxContentWidth) - Spacing.four * 2)}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Progress</ThemedText>
          </View>

          {chartWidth > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                DAY TRACKING
              </ThemedText>
              <ThemedView type="surface" style={styles.card}>
                <StatHeader label="Workout activity" latest="Year to date" caption="daily sessions" />
                <ContributionGrid sessions={sessions} cardioSessions={cardioSessions} width={chartWidth} />
              </ThemedView>
            </>
          )}

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            TRACKING
          </ThemedText>

          <View style={styles.metricRangeRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Chart range
            </ThemedText>
            <Dropdown
              label={METRIC_RANGE_LABELS[metricRange]}
              options={(['week', 'month', 'all'] as MetricRange[]).map((r) => ({ id: r, label: METRIC_RANGE_LABELS[r] }))}
              onSelect={(id) => setMetricRange(id as MetricRange)}
            />
          </View>

          {stepsPoints.length > 0 && (
            <ThemedView type="surface" style={styles.card}>
              <StatHeader
                label="Steps"
                latest={`${stepsPoints[stepsPoints.length - 1].value.toLocaleString()}`}
                caption={METRIC_RANGE_LABELS[metricRange].toLowerCase()}
              />
              {chartWidth > 0 && <LineChart points={stepsPoints} width={chartWidth} color={ChartColors.steps} />}
            </ThemedView>
          )}

          {caloriePoints.length > 0 && (
            <ThemedView type="surface" style={styles.card}>
              <StatHeader
                label="Calories burned"
                latest={`${caloriePoints[caloriePoints.length - 1].value} cal`}
                caption={deltaCaption(caloriePoints, 'cal')}
              />
              {chartWidth > 0 && <LineChart points={caloriePoints} width={chartWidth} color={ChartColors.calories} />}
            </ThemedView>
          )}

          {cardioPoints.length > 0 && (
            <ThemedView type="surface" style={styles.card}>
              <StatHeader
                label="Cardio"
                latest={`${cardioPoints[cardioPoints.length - 1].value} min`}
                caption={deltaCaption(cardioPoints, 'min')}
              />
              {chartWidth > 0 && <LineChart points={cardioPoints} width={chartWidth} color={ChartColors.cardio} />}
            </ThemedView>
          )}

          {waterPoints.length > 0 && (
            <ThemedView type="surface" style={styles.card}>
              <StatHeader
                label="Water"
                latest={`${waterPoints[waterPoints.length - 1].value} ${volumeUnitLabel(unitSystem)}`}
                caption={deltaCaption(waterPoints, volumeUnitLabel(unitSystem))}
              />
              {chartWidth > 0 && <LineChart points={waterPoints} width={chartWidth} color={ChartColors.water} />}
            </ThemedView>
          )}

          {bodyweightPoints.length > 0 && (
            <ThemedView type="surface" style={styles.card}>
              <StatHeader
                label="Body weight"
                latest={`${bodyweightPoints[bodyweightPoints.length - 1].value} ${weightUnitLabel(unitSystem)}`}
                caption={deltaCaption(bodyweightPoints, weightUnitLabel(unitSystem))}
              />
              {chartWidth > 0 && <LineChart points={bodyweightPoints} width={chartWidth} color={ChartColors.bodyweight} />}
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
                searchable
              />
            )}
          </View>

          {strengthPoints.length > 0 ? (
            <ThemedView type="surface" style={styles.card}>
              <StatHeader
                label={exercise!}
                latest={`${strengthPoints[strengthPoints.length - 1].value} ${weightUnitLabel(unitSystem)}`}
                caption={deltaCaption(strengthPoints, weightUnitLabel(unitSystem))}
              />
              {chartWidth > 0 && <LineChart points={strengthPoints} width={chartWidth} color={ChartColors.strength} />}
            </ThemedView>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Log workouts to see strength trends per movement.
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </TabFadeView>
  );
}

function filterPoints(points: ProgressPoint[], range: MetricRange): ProgressPoint[] {
  if (range === 'all') return points;
  const start = new Date();
  start.setDate(start.getDate() - (range === 'week' ? 6 : 29));
  const startKey = toDateKey(start);
  return points.filter((point) => point.date >= startKey);
}

function aggregateByDate<T extends { date: string }>(entries: T[], valueFor: (entry: T) => number): ProgressPoint[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + valueFor(entry));
  }
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
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
  searchable = false,
}: {
  label: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();
  const filtered = searchable
    ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height + 6, right: screenWidth - (x + width) });
      setOpen(true);
    });
  };

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.dropdown}>
      <Pressable ref={triggerRef} style={styles.dropdownTrigger} onPress={openMenu}>
        <ThemedText type="small">{label}</ThemedText>
        <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={11} tintColor={colors.textSecondary} />
      </Pressable>
      {/* Rendered in a Modal (its own native overlay layer) so it always draws above the anchored TabBar, which lives outside this screen's view tree and ignores in-screen zIndex. */}
      <Modal transparent visible={open} animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.modalBackdrop} onPress={closeMenu} />
        {anchor && (
          <View style={[styles.dropdownMenu, { top: anchor.top, right: anchor.right }]}>
            {searchable && (
              <TextInput
                style={styles.dropdownSearch}
                placeholder="Search movement"
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
              />
            )}
            <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
              {filtered.map((option, index) => (
                <Pressable
                  key={option.id}
                  style={[styles.dropdownOption, index > 0 && styles.dropdownOptionDivider]}
                  onPress={() => {
                    onSelect(option.id);
                    closeMenu();
                  }}>
                  <ThemedText type="small" themeColor={option.label === label ? 'primaryLight' : 'text'}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>
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
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  metricRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  dropdownMenu: {
    position: 'absolute',
    minWidth: 160,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropdownSearch: {
    minWidth: 220,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dropdownOptionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
