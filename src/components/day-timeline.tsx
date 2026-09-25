import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS } from '@/lib/activity-icons';
import {
  formatClock,
  formatSpan,
  macroSummary,
  mealEventTitle,
  roundToMinutes,
  type TimelineNode,
} from '@/lib/store/derive';
import type { UnitSystem, WaterEntry } from '@/lib/store/types';
import { toDisplayVolume, volumeUnitLabel } from '@/lib/units';

const colors = Colors;
const TIME_COLUMN = 64;
const SPINE_COLUMN = 20;
const DOT = 10;

/**
 * The Food tab's day, oldest first on a vertical spine: meal events as
 * cards, water as small hollow marks, finished workouts/cardio as lime
 * read-only context, collapsed gaps you can tap to log into, and on today a
 * lime NOW rule. The trailing row always offers "Add" at a sensible time.
 */
export function DayTimeline({
  nodes,
  calorieGoal,
  unitSystem,
  defaultAddAt,
  onAddAt,
  onPressWater,
  onNowLayout,
}: {
  nodes: TimelineNode[];
  calorieGoal: number;
  unitSystem: UnitSystem;
  /** ISO time the trailing Add row logs at. */
  defaultAddAt: string;
  onAddAt: (iso: string) => void;
  onPressWater: (entry: WaterEntry) => void;
  /** y of the NOW rule within the timeline, for the screen to scroll to. */
  onNowLayout?: (y: number) => void;
}) {
  const hasEntries = nodes.some((node) => node.kind !== 'gap' && node.kind !== 'now');

  return (
    <View>
      {!hasEntries && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Nothing logged yet. Add a meal or a glass of water and it lands here at the time you had it.
        </ThemedText>
      )}
      {nodes.map((node) => {
        switch (node.kind) {
          case 'food':
            return <FoodNode key={node.key} node={node} calorieGoal={calorieGoal} />;
          case 'water':
            return (
              <WaterNode key={node.key} entry={node.entry} unitSystem={unitSystem} onPress={onPressWater} />
            );
          case 'workout':
          case 'cardio':
            return <SessionNode key={node.key} node={node} />;
          case 'gap':
            return <GapNode key={node.key} node={node} onAddAt={onAddAt} />;
          case 'now':
            return (
              <View key={node.key} onLayout={(event) => onNowLayout?.(event.nativeEvent.layout.y)}>
                <NowRule at={node.startMs} />
              </View>
            );
        }
      })}
      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        onPress={() => onAddAt(defaultAddAt)}>
        <SymbolView name="plus" size={14} tintColor={colors.primaryLight} />
        <ThemedText type="smallBold" style={styles.addLabel}>
          Add at {formatClock(defaultAddAt)}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** Time column + spine column + content — the shared skeleton of every row. */
function Row({
  time,
  marker,
  dashed,
  children,
}: {
  time?: string;
  marker: React.ReactNode;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.timeColumn}>
        {time && (
          <ThemedText type="statInline" themeColor="textSecondary" numberOfLines={1}>
            {time}
          </ThemedText>
        )}
      </View>
      <View style={styles.spineColumn}>
        <View style={[styles.spine, dashed && styles.spineDashed]} />
        <View style={styles.marker}>{marker}</View>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

function FoodNode({ node, calorieGoal }: { node: Extract<TimelineNode, { kind: 'food' }>; calorieGoal: number }) {
  const names = node.items.map((item) => item.name).join(' · ');
  return (
    <Row time={formatClock(node.startMs)} marker={<View style={styles.foodDot} />}>
      <Pressable
        style={({ pressed }) => [styles.foodCard, pressed && styles.foodCardPressed]}
        onPress={() => router.push({ pathname: '/food/event/[id]', params: { id: node.event.id } })}>
        <View style={styles.foodHeader}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
            {mealEventTitle(node.event)}
          </ThemedText>
          <ThemedText type="small">
            <ThemedText type="statInline">{Math.round(node.totals.calories)}</ThemedText> cal
          </ThemedText>
        </View>
        {names.length > 0 && (
          <ThemedText type="small" numberOfLines={2}>
            {names}
          </ThemedText>
        )}
        <View style={styles.foodFooter}>
          <ThemedText type="caption" themeColor="textSecondary">
            {macroSummary(node.totals)}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {Math.round(node.runningCalories).toLocaleString()} / {Math.round(calorieGoal).toLocaleString()} today
          </ThemedText>
        </View>
      </Pressable>
    </Row>
  );
}

function WaterNode({
  entry,
  unitSystem,
  onPress,
}: {
  entry: WaterEntry;
  unitSystem: UnitSystem;
  onPress: (entry: WaterEntry) => void;
}) {
  const amount = toDisplayVolume(Math.abs(entry.ounces), unitSystem);
  return (
    <Row time={formatClock(entry.loggedAt)} marker={<View style={styles.waterDot} />}>
      <Pressable hitSlop={4} style={styles.inlineRow} onPress={() => onPress(entry)}>
        <SymbolView name="drop.fill" size={14} tintColor={colors.textSecondary} />
        <ThemedText type="small">
          {entry.ounces < 0 ? '−' : ''}
          <ThemedText type="statInline">{amount}</ThemedText> {volumeUnitLabel(unitSystem)} water
        </ThemedText>
      </Pressable>
    </Row>
  );
}

function SessionNode({ node }: { node: Extract<TimelineNode, { kind: 'workout' | 'cardio' }> }) {
  const isCardio = node.kind === 'cardio';
  const name = isCardio ? node.session.name : node.session.routineName;
  const minutes = isCardio ? node.session.minutes : node.session.durationMinutes;
  const calories = node.session.calories;
  const icon = isCardio ? ACTIVITY_ICONS[node.session.activityType] : 'dumbbell.fill';
  const open = () =>
    isCardio
      ? router.push({ pathname: '/history/cardio/[id]', params: { id: node.session.id } })
      : router.push({ pathname: '/history/[id]', params: { id: node.session.id } });

  return (
    <Row
      time={formatClock(node.startMs)}
      marker={<SymbolView name={icon} size={14} tintColor={colors.primary} />}>
      <Pressable hitSlop={4} style={styles.sessionRow} onPress={open}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          <ThemedText type="caption">{Math.round(minutes)}</ThemedText> min
          {calories !== undefined && (
            <>
              {' · '}
              <ThemedText type="caption">{Math.round(calories)}</ThemedText> cal burned
            </>
          )}
          {' · until '}
          {formatClock(node.endMs)}
        </ThemedText>
      </Pressable>
    </Row>
  );
}

function GapNode({ node, onAddAt }: { node: Extract<TimelineNode, { kind: 'gap' }>; onAddAt: (iso: string) => void }) {
  const midpoint = roundToMinutes((node.startMs + node.endMs) / 2);
  return (
    <Row marker={null} dashed>
      <Pressable
        hitSlop={4}
        style={styles.gapRow}
        onPress={() => onAddAt(new Date(midpoint).toISOString())}>
        <ThemedText type="caption" themeColor="textSecondary">
          {formatSpan(node.minutes)}
        </ThemedText>
        <ThemedText type="caption" style={styles.addLabel}>
          + Add at {formatClock(midpoint)}
        </ThemedText>
      </Pressable>
    </Row>
  );
}

function NowRule({ at }: { at: number }) {
  return (
    <View style={styles.nowRow}>
      <View style={styles.nowLine} />
      <ThemedText type="caption" style={styles.nowLabel}>
        NOW {formatClock(at)}
      </ThemedText>
      <View style={styles.nowLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  empty: {
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeColumn: {
    width: TIME_COLUMN,
    alignItems: 'flex-end',
    paddingRight: Spacing.two,
    paddingTop: Spacing.two,
  },
  spineColumn: {
    width: SPINE_COLUMN,
    alignItems: 'center',
  },
  spine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  },
  spineDashed: {
    backgroundColor: 'transparent',
    borderLeftWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  marker: {
    marginTop: Spacing.two + 5 - DOT / 2,
    minHeight: DOT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  foodDot: {
    width: DOT,
    height: DOT,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
  },
  waterDot: {
    width: DOT,
    height: DOT,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingLeft: Spacing.two,
    paddingBottom: Spacing.two,
  },
  foodCard: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  foodCardPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  foodFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  sessionRow: {
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
  gapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  addLabel: {
    color: colors.primaryLight,
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  nowLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.primary,
  },
  nowLabel: {
    color: colors.primary,
  },
  addButton: {
    marginTop: Spacing.two,
    marginLeft: TIME_COLUMN + SPINE_COLUMN + Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
});
