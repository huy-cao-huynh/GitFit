import { useRef, useState } from 'react';
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
import { SymbolView } from 'expo-symbols';

import { AnimatedNumber } from '@/components/animated-number';
import { ContributionGrid } from '@/components/contribution-grid';
import { IconButton } from '@/components/icon-button';
import { LineChart } from '@/components/line-chart';
import { ScreenBackground } from '@/components/screen-background';
import { TabFadeView } from '@/components/tab-fade-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ChartColors, Colors, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import {
  ageFromBirthday,
  bmi,
  bodyFatPercent,
  exerciseNames,
  measurementSeries,
  strengthSeries,
  toDateKey,
  todayKey,
  type Sex,
} from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { ProgressPoint } from '@/lib/store/types';
import {
  formatWeight,
  fromDisplayWeight,
  toDisplayVolume,
  toDisplayWeight,
  volumeUnitLabel,
  weightUnitLabel,
} from '@/lib/units';
import { useAuth } from '@/providers/auth-provider';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type MetricRange = 'week' | 'month' | 'all';
const METRIC_RANGE_LABELS: Record<MetricRange, string> = { week: 'Week', month: 'Month', all: 'All time' };

export default function ProgressScreen() {
  const {
    sessions,
    cardioSessions,
    bodyweight,
    addBodyweight,
    steps,
    waterEntries,
    measurementDefs,
    setMeasurementDefs,
    measurementEntries,
    addMeasurementEntry,
    preferences,
  } = useStore();
  const { session } = useAuth();
  const unitSystem = preferences.unitSystem;
  const [metricRange, setMetricRange] = useState<MetricRange>('month');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [weight, setWeight] = useState('');
  const [newMeasurementLabel, setNewMeasurementLabel] = useState('');
  const [newMeasurementUnit, setNewMeasurementUnit] = useState(unitSystem === 'metric' ? 'cm' : 'in');
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});

  const latestWeight = bodyweight[bodyweight.length - 1];
  const metadata = session?.user.user_metadata ?? {};
  const heightInches = Number(metadata.height_inches as string | undefined) || null;
  const birthday = (metadata.birthday as string | undefined) || null;
  const sex = ((metadata.sex as string | undefined) ?? 'unset') as Sex | 'unset';
  const bmiValue = bmi(latestWeight?.weight ?? null, heightInches);
  const age = ageFromBirthday(birthday);
  const bodyFat = bodyFatPercent(bmiValue, age, sex === 'unset' ? null : sex);

  const saveWeight = () => {
    const displayValue = Number(weight);
    if (!Number.isFinite(displayValue) || displayValue <= 0) return;
    addBodyweight({ date: todayKey(), weight: fromDisplayWeight(displayValue, unitSystem) });
    setWeight('');
  };

  const addMeasurementSection = () => {
    const label = newMeasurementLabel.trim();
    const unit = newMeasurementUnit.trim();
    if (!label || !unit) return;
    if (measurementDefs.some((def) => def.label.toLowerCase() === label.toLowerCase())) return;
    setMeasurementDefs([...measurementDefs, { id: makeId(), label, unit }]);
    setNewMeasurementLabel('');
  };

  const saveMeasurement = (defId: string, label: string, unit: string) => {
    const raw = measurementValues[defId];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    addMeasurementEntry({ id: makeId(), date: todayKey(), label, value, unit });
    setMeasurementValues((current) => ({ ...current, [defId]: '' }));
  };

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
  // Half-width bento tile: (content − gap) / 2, minus the tile's own padding.
  const tileChartWidth = contentWidth > 0 ? (contentWidth - Spacing.two) / 2 - Spacing.three * 2 : 0;

  return (
    <TabFadeView style={styles.container}>
      <ScreenBackground>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              <View style={[styles.card, styles.invertedCard]}>
                <View style={styles.statHeader}>
                  <View>
                    <ThemedText type="small" style={styles.invertedTextDim}>
                      Workout activity
                    </ThemedText>
                    <ThemedText type="subtitle" style={[styles.statValue, styles.invertedText]}>
                      Year to date
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={styles.invertedTextDim}>
                    daily sessions
                  </ThemedText>
                </View>
                <ContributionGrid sessions={sessions} cardioSessions={cardioSessions} width={chartWidth} inverted />
              </View>
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

          {tileChartWidth > 0 && (cardioPoints.length > 0 || waterPoints.length > 0) && (
            <View style={styles.tileGrid}>
              {cardioPoints.length > 0 && (
                <StatTile
                  label="Cardio"
                  value={cardioPoints[cardioPoints.length - 1].value}
                  unit="min"
                  points={cardioPoints}
                  color={ChartColors.cardio}
                  chartWidth={tileChartWidth}
                />
              )}
              {waterPoints.length > 0 && (
                <StatTile
                  label="Water"
                  value={waterPoints[waterPoints.length - 1].value}
                  unit={volumeUnitLabel(unitSystem)}
                  points={waterPoints}
                  color={ChartColors.water}
                  chartWidth={tileChartWidth}
                />
              )}
            </View>
          )}

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            BODY
          </ThemedText>

          <ThemedView type="surface" style={styles.card}>
            <StatHeader
              label="Body weight"
              latest={latestWeight ? formatWeight(latestWeight.weight, unitSystem) : 'No logs'}
              caption={deltaCaption(bodyweightPoints, weightUnitLabel(unitSystem))}
            />
            <View style={styles.entryRow}>
              <TextInput
                style={[styles.entryInput, styles.flex]}
                placeholder={`Log today's weight (${weightUnitLabel(unitSystem)})`}
                placeholderTextColor={colors.textSecondary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
              <IconButton icon="checkmark.circle.fill" active={!!weight.trim()} onPress={saveWeight} />
            </View>
            {chartWidth > 0 && bodyweightPoints.length > 1 && (
              <LineChart points={bodyweightPoints} width={chartWidth} color={ChartColors.bodyweight} />
            )}
          </ThemedView>

          <ThemedView type="surface" style={styles.card}>
            <ThemedText type="smallBold">BMI &amp; Body Fat</ThemedText>
            {bmiValue !== null ? (
              <>
                <ThemedText type="small">
                  BMI <ThemedText type="smallBold">{bmiValue}</ThemedText>
                </ThemedText>
                <ThemedText type="small">
                  Body fat{' '}
                  <ThemedText type="smallBold">{bodyFat !== null ? `${bodyFat}%` : '—'}</ThemedText>
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {bodyFat !== null
                    ? 'Rough estimate — accurate body-composition tracking is coming later.'
                    : 'Add birthday & sex in Settings for a body-fat estimate.'}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Log your weight and add height in Settings to see BMI.
              </ThemedText>
            )}
          </ThemedView>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            MEASUREMENTS
          </ThemedText>

          {measurementDefs.map((def) => {
            const latest = measurementEntries.find((entry) => entry.label === def.label);
            const points = filterPoints(measurementSeries(measurementEntries, def.label), metricRange);
            return (
              <ThemedView key={def.id} type="surface" style={styles.card}>
                <View style={styles.measurementHeader}>
                  <View style={styles.flex}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {def.label}
                    </ThemedText>
                    <ThemedText type="subtitle" style={styles.statValue}>
                      {latest ? `${latest.value} ${latest.unit}` : 'No logs'}
                    </ThemedText>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setMeasurementDefs(measurementDefs.filter((existing) => existing.id !== def.id))}>
                    <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.entryRow}>
                  <TextInput
                    style={[styles.entryInput, styles.flex]}
                    placeholder={`Log ${def.label.toLowerCase()} (${def.unit})`}
                    placeholderTextColor={colors.textSecondary}
                    value={measurementValues[def.id] ?? ''}
                    onChangeText={(text) => setMeasurementValues((current) => ({ ...current, [def.id]: text }))}
                    keyboardType="decimal-pad"
                  />
                  <IconButton
                    icon="checkmark.circle.fill"
                    active={!!measurementValues[def.id]?.trim()}
                    onPress={() => saveMeasurement(def.id, def.label, def.unit)}
                  />
                </View>
                {chartWidth > 0 && points.length > 1 && (
                  <LineChart points={points} width={chartWidth} height={56} color={ChartColors.bodyweight} sparkline />
                )}
              </ThemedView>
            );
          })}

          <ThemedView type="surface" style={styles.card}>
            <ThemedText type="smallBold">Add measurement section</ThemedText>
            <View style={styles.entryRow}>
              <TextInput
                style={[styles.entryInput, styles.flex]}
                placeholder="e.g. Chest"
                placeholderTextColor={colors.textSecondary}
                value={newMeasurementLabel}
                onChangeText={setNewMeasurementLabel}
              />
              <TextInput
                style={[styles.entryInput, styles.unitInput]}
                placeholder="Unit"
                placeholderTextColor={colors.textSecondary}
                value={newMeasurementUnit}
                onChangeText={setNewMeasurementUnit}
              />
              <IconButton
                icon="plus.circle.fill"
                active={!!newMeasurementLabel.trim() && !!newMeasurementUnit.trim()}
                onPress={addMeasurementSection}
              />
            </View>
          </ThemedView>

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
        </KeyboardAvoidingView>
      </SafeAreaView>
      </ScreenBackground>
    </TabFadeView>
  );
}

function StatTile({
  label,
  value,
  unit,
  points,
  color,
  chartWidth,
}: {
  label: string;
  value: number;
  unit: string;
  points: ProgressPoint[];
  color: string;
  chartWidth: number;
}) {
  return (
    <ThemedView type="surface" style={styles.tile}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.tileValueRow}>
        <AnimatedNumber value={value} style={styles.tileValue} />
        <ThemedText type="small" themeColor="textSecondary">
          {unit}
        </ThemedText>
      </View>
      <LineChart points={points} width={chartWidth} height={56} color={color} sparkline />
    </ThemedView>
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
  invertedCard: {
    backgroundColor: colors.volt,
    borderColor: 'transparent',
  },
  invertedText: {
    color: colors.background,
  },
  invertedTextDim: {
    color: 'rgba(8,8,13,0.65)',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  tileValue: {
    ...Type.numeric,
    fontSize: 22,
    lineHeight: 28,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  entryInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 14,
  },
  unitInput: {
    width: 72,
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
