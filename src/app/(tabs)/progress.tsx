import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { AnimatedNumber } from '@/components/animated-number';
import { BarChart, type BarChartBar } from '@/components/bar-chart';
import { ContributionGrid } from '@/components/contribution-grid';
import { LineChart } from '@/components/line-chart';
import { RangeToggle } from '@/components/range-toggle';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ChartColors, Colors, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { exerciseNames, strengthSeries, toDateKey } from '@/lib/store/derive';
import type { ProgressPoint, Session, StepsEntry } from '@/lib/store/types';
import { useResetScrollOnFocus } from '@/lib/use-reset-scroll-on-focus';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { funWeightUnit } from '@/lib/weight-fun-units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type MetricRange = 'week' | 'month' | 'all';
const METRIC_RANGE_LABELS: Record<MetricRange, string> = { week: 'Week', month: 'Month', all: 'All time' };
const METRIC_RANGE_OPTIONS = (['week', 'month', 'all'] as MetricRange[]).map((id) => ({
  id,
  label: METRIC_RANGE_LABELS[id],
}));

type StepsRange = 'week' | 'month' | 'year';
const STEPS_RANGE_LABELS: Record<StepsRange, string> = { week: 'Week', month: 'Month', year: 'Year' };
const STEPS_RANGE_OPTIONS = (['week', 'month', 'year'] as StepsRange[]).map((id) => ({
  id,
  label: STEPS_RANGE_LABELS[id],
}));

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ProgressScreen() {
  const { sessions, cardioSessions, bodyweight, steps, preferences } = useStore();
  const unitSystem = preferences.unitSystem;
  const [stepsRange, setStepsRange] = useState<StepsRange>('week');
  const [clusterRange, setClusterRange] = useState<MetricRange>('month');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [showFunUnit, setShowFunUnit] = useState(true);
  const scrollRef = useResetScrollOnFocus<ScrollView>();

  const latestWeight = bodyweight[bodyweight.length - 1];

  const currentYear = String(new Date().getFullYear());
  const yearSessionCount =
    sessions.filter((s) => s.date.startsWith(currentYear)).length +
    cardioSessions.filter((s) => s.date.startsWith(currentYear)).length;

  const names = exerciseNames(sessions);
  const hasExercises = names.length > 0;
  const exercise = selectedExercise ?? names[0];
  const strengthPoints = filterPoints(exercise ? strengthSeries(sessions, exercise) : [], clusterRange).map(
    (point) => ({
      ...point,
      value: toDisplayWeight(point.value, unitSystem),
    }),
  );
  const stepsBars = buildStepsBars(steps, stepsRange);
  const stepsLatest = stepsBars.find((bar) => bar.highlighted)?.value ?? 0;
  const bodyweightPoints: ProgressPoint[] = filterPoints(
    bodyweight.map((entry) => ({ date: entry.date, value: toDisplayWeight(entry.weight, unitSystem) })),
    clusterRange,
  );
  const calorieSources = [
    ...sessions.map((s) => ({ date: s.date, calories: s.calories ?? 0 })),
    ...cardioSessions.map((s) => ({ date: s.date, calories: s.calories ?? 0 })),
  ];
  const caloriePoints = filterPoints(aggregateByDate(calorieSources, (entry) => entry.calories), clusterRange);
  const volumePoints = filterPoints(
    aggregateByDate(sessions.map((s) => ({ date: s.date, volume: sessionVolume(s) })), (entry) => entry.volume),
    clusterRange,
  );
  const totalVolumeLbs = volumePoints.reduce((sum, point) => sum + point.value, 0);
  const caloriesTotal = caloriePoints.reduce((sum, point) => sum + point.value, 0);
  const funVolume = funWeightUnit(totalVolumeLbs);
  const totalLifted = showFunUnit
    ? { value: funVolume.value, unit: funVolume.unit, decimals: 1, grouped: false }
    : { value: toDisplayWeight(totalVolumeLbs, unitSystem), unit: weightUnitLabel(unitSystem), decimals: 0, grouped: true };

  const chartWidth = contentWidth > 0 ? contentWidth - Spacing.three * 2 : 0;
  // Half-width bento tile: (content − gap) / 2, minus the tile's own padding.
  const tileChartWidth = contentWidth > 0 ? (contentWidth - Spacing.two) / 2 - Spacing.three * 2 : 0;

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => setContentWidth(Math.min(event.nativeEvent.layout.width, MaxContentWidth) - Spacing.four * 2)}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText type="subtitle">Progress</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Track your activity and strength over time
              </ThemedText>
            </View>
          </View>

          {chartWidth > 0 && (
            <View style={[styles.card, styles.invertedCard]}>
              <View style={styles.statHeader}>
                <View>
                  <ThemedText type="small" style={styles.invertedTextDim}>
                    Daily sessions
                  </ThemedText>
                  <ThemedText type="stat" style={styles.invertedText}>
                    {yearSessionCount}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={styles.invertedTextDim}>
                  Year to date
                </ThemedText>
              </View>
              <ContributionGrid sessions={sessions} cardioSessions={cardioSessions} width={chartWidth} inverted />
            </View>
          )}

          <ThemedText type="label" style={styles.sectionLabel}>
            TRACKING
          </ThemedText>

          <ThemedView type="surface" style={styles.card}>
            <StatHeader label="Steps" latest={stepsLatest.toLocaleString()} caption={STEPS_RANGE_LABELS[stepsRange].toLowerCase()} />
            <RangeToggle options={STEPS_RANGE_OPTIONS} value={stepsRange} onChange={setStepsRange} />
            {chartWidth > 0 && <BarChart bars={stepsBars} width={chartWidth} color={ChartColors.steps} />}
            {steps.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                Steps sync once Apple Health is connected.
              </ThemedText>
            )}
          </ThemedView>

          <RangeToggle options={METRIC_RANGE_OPTIONS} value={clusterRange} onChange={setClusterRange} />

          {tileChartWidth > 0 && (
            <View style={styles.tileGrid}>
              <MetricTile
                label="Weight"
                value={latestWeight ? toDisplayWeight(latestWeight.weight, unitSystem) : null}
                unit={weightUnitLabel(unitSystem)}
                points={bodyweightPoints}
                color={ChartColors.bodyweight}
                chartWidth={tileChartWidth}
                smooth
              />
              <MetricTile
                label={
                  hasExercises ? (
                    <Dropdown
                      label={exercise ?? ''}
                      options={names.map((name) => ({ id: name, label: name }))}
                      onSelect={setSelectedExercise}
                      searchable
                    />
                  ) : (
                    'Strength'
                  )
                }
                value={strengthPoints.length > 0 ? strengthPoints[strengthPoints.length - 1].value : null}
                unit={weightUnitLabel(unitSystem)}
                points={strengthPoints}
                color={ChartColors.strength}
                chartWidth={tileChartWidth}
              />
              <MetricTile
                label="Calories burned"
                icon="flame.fill"
                iconColor={Colors.primary}
                value={caloriesTotal > 0 ? caloriesTotal : null}
                unit="cal"
                points={caloriePoints}
                color={ChartColors.calories}
                chartWidth={tileChartWidth}
                showChart={false}
                grouped
              />
              <MetricTile
                label="Total lifted"
                value={totalVolumeLbs > 0 ? totalLifted.value : null}
                unit={totalLifted.unit}
                points={volumePoints}
                color={ChartColors.strength}
                chartWidth={tileChartWidth}
                showChart={false}
                decimals={totalLifted.decimals}
                grouped={totalLifted.grouped}
                onPress={() => setShowFunUnit((current) => !current)}
                trailingIcon="arrow.triangle.2.circlepath"
              />
            </View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
}

function MetricTile({
  label,
  icon,
  iconColor,
  value,
  unit,
  points,
  color,
  chartWidth,
  decimals = 0,
  grouped = false,
  smooth = false,
  showChart = true,
  onPress,
  trailingIcon,
}: {
  label: ReactNode;
  icon?: SFSymbol;
  iconColor?: string;
  value: number | null;
  unit: string;
  points: ProgressPoint[];
  color: string;
  chartWidth: number;
  decimals?: number;
  grouped?: boolean;
  smooth?: boolean;
  showChart?: boolean;
  onPress?: () => void;
  trailingIcon?: SFSymbol;
}) {
  const content = (
    <>
      <View style={styles.tileLabelRow}>
        {icon && <SymbolView name={icon} size={13} tintColor={iconColor ?? colors.textSecondary} />}
        {typeof label === 'string' ? (
          <ThemedText type="small" numberOfLines={1} style={styles.flex}>
            {label}
          </ThemedText>
        ) : (
          label
        )}
        {trailingIcon && <SymbolView name={trailingIcon} size={11} tintColor={colors.textSecondary} />}
      </View>
      {value !== null ? (
        <>
          <View style={[styles.tileValueRow, !showChart && styles.tileValueRowLarge]}>
            <AnimatedNumber
              value={value}
              decimals={decimals}
              grouped={grouped}
              style={showChart ? styles.tileValue : styles.tileValueLarge}
            />
            <ThemedText type="small">{unit}</ThemedText>
          </View>
          {showChart && points.length > 1 && (
            <LineChart points={points} width={chartWidth} height={56} color={color} sparkline smooth={smooth} />
          )}
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No logs
        </ThemedText>
      )}
    </>
  );

  return (
    <ThemedView type="surface" style={styles.tile}>
      {onPress ? (
        <Pressable onPress={onPress} style={[styles.tileInner, !showChart && styles.tileInnerCentered]}>
          {content}
        </Pressable>
      ) : (
        <View style={[styles.tileInner, !showChart && styles.tileInnerCentered]}>{content}</View>
      )}
    </ThemedView>
  );
}

/** Total working-set volume (reps × weight) for a session, canonical lbs. */
function sessionVolume(session: Session): number {
  let total = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      if (set.isWarmup || set.skipped) continue;
      if (set.weight && set.reps) total += set.weight * set.reps;
    }
  }
  return total;
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

function stepsForDate(steps: StepsEntry[], dateKey: string): number {
  return steps.find((entry) => entry.date === dateKey)?.steps ?? 0;
}

/** Buckets StepsEntry[] into day-of-week (week), day-of-month (month), or month (year) bars. */
function buildStepsBars(steps: StepsEntry[], range: StepsRange): BarChartBar[] {
  const today = new Date();
  const todayKeyValue = toDateKey(today);

  if (range === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dateKey = toDateKey(date);
      return { label: WEEKDAY_LABELS[index], value: stepsForDate(steps, dateKey), highlighted: dateKey === todayKeyValue };
    });
  }

  if (range === 'month') {
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = toDateKey(new Date(year, month, day));
      const showLabel = day === 1 || day === 15 || day === daysInMonth;
      return {
        label: showLabel ? String(day) : '',
        value: stepsForDate(steps, dateKey),
        highlighted: dateKey === todayKeyValue,
      };
    });
  }

  const year = today.getFullYear();
  const currentMonth = today.getMonth();
  const monthTotals = new Array(12).fill(0);
  for (const entry of steps) {
    const [entryYear, entryMonth] = entry.date.split('-').map(Number);
    if (entryYear === year) monthTotals[entryMonth - 1] += entry.steps;
  }
  return monthTotals.map((value, index) => ({ label: MONTH_LABELS[index], value, highlighted: index === currentMonth }));
}

function StatHeader({ label, latest, caption }: { label: string; latest: string; caption?: string }) {
  // deltaCaption prefixes gains with '+' — those read as wins, so they go lime.
  const isGain = caption?.startsWith('+');
  return (
    <View style={styles.statHeader}>
      <View>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="stat">{latest}</ThemedText>
      </View>
      {caption ? (
        <ThemedText type="statInline" themeColor={isGain ? 'primary' : 'textSecondary'}>
          {caption}
        </ThemedText>
      ) : null}
    </View>
  );
}

const MENU_MAX_HEIGHT = 220;
const SEARCH_HEIGHT = 44;
const MENU_WIDTH = 180;
const SEARCH_MENU_WIDTH = 240;
const EDGE_MARGIN = Spacing.three;

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
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const triggerRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const menuWidth = searchable ? SEARCH_MENU_WIDTH : MENU_WIDTH;
  const filtered = useMemo(
    () =>
      searchable ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())) : options,
    [options, query, searchable],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [query]);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuHeight = MENU_MAX_HEIGHT + (searchable ? SEARCH_HEIGHT : 0);
      const spaceBelow = screenHeight - (y + height);
      const spaceAbove = y;
      const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;
      // Anchor from the trigger's left edge, but clamp so the menu can never render off either edge of the screen.
      const left = Math.min(Math.max(x, EDGE_MARGIN), screenWidth - menuWidth - EDGE_MARGIN);
      setAnchor(
        openUpward ? { bottom: screenHeight - y + 6, left } : { top: y + height + 6, left },
      );
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
        <ThemedText type="small" numberOfLines={1} style={styles.dropdownLabel}>
          {label}
        </ThemedText>
        <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={11} tintColor={colors.textSecondary} />
      </Pressable>
      {/* Rendered in a Modal (its own native overlay layer) so it always draws above the anchored TabBar, which lives outside this screen's view tree and ignores in-screen zIndex. */}
      <Modal transparent visible={open} animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.modalBackdrop} onPress={closeMenu} />
        {anchor && (
          <View style={[styles.dropdownMenu, { top: anchor.top, bottom: anchor.bottom, left: anchor.left, width: menuWidth }]}>
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
            <ScrollView ref={scrollRef} style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.dropdownEmpty}>
                  No movements match &quot;{query.trim()}&quot;
                </ThemedText>
              ) : (
                filtered.map((option, index) => (
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
                ))
              )}
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
  flex: {
    flex: 1,
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
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  invertedCard: {
    backgroundColor: colors.primary,
  },
  invertedText: {
    color: colors.onPrimary,
  },
  invertedTextDim: {
    color: Colors.onPrimaryDim,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 140,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  tileInner: {
    flex: 1,
    gap: Spacing.one,
  },
  tileInnerCentered: {
    justifyContent: 'center',
  },
  tileLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  tileValueRowLarge: {
    marginTop: Spacing.one,
  },
  tileValue: {
    ...Type.statSm,
    fontSize: 22,
    lineHeight: 28,
  },
  tileValueLarge: {
    ...Type.statMd,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dropdown: {
    position: 'relative',
    flexShrink: 1,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dropdownLabel: {
    flexShrink: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  dropdownMenu: {
    position: 'absolute',
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  dropdownSearch: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  dropdownScroll: {
    maxHeight: MENU_MAX_HEIGHT,
  },
  dropdownOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dropdownOptionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dropdownEmpty: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
