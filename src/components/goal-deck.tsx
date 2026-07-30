import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MetricGauge } from '@/components/metric-gauge';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { CHECK_IN_ICON, INTAKE_ICON, METRIC_ICONS } from '@/lib/metric-icons';
import type { DashboardMetric } from '@/lib/store/derive';
import type { UnitSystem } from '@/lib/store/types';
import { toDisplayVolume, volumeUnitLabel } from '@/lib/units';

const colors = Colors;
const GAUGE_SIZE = 132;
/**
 * Fraction of the page distance the text actually travels. Below 1 the copy
 * slides from centre toward the left edge while the next page comes from the
 * right to centre, instead of sweeping the full width of the card.
 */
const TEXT_TRAVEL = 0.45;
/**
 * How far a page travels before it's fully faded, as a fraction of the page
 * width. Deliberately over 0.5 so outgoing and incoming pages overlap through
 * the middle — at exactly 0.5 both hit zero at once and the card blinks empty.
 */
const FADE_DISTANCE = 0.7;

/**
 * The dashboard hero: one metric at a time on a lime card, swiped between.
 * The gauge is deliberately parked outside the pager and pointer-transparent —
 * it stays put while the labels and numbers page beneath it, and swipes that
 * start on the gauge still reach the ScrollView.
 */
export function GoalDeck({ metrics, unitSystem }: { metrics: DashboardMetric[]; unitSystem: UnitSystem }) {
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const committed = useSharedValue(0);

  const commitIndex = useCallback((next: number) => {
    haptics.selection();
    setIndex(next);
  }, []);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
    const width = event.layoutMeasurement.width;
    if (width <= 0) return;
    // Commit as soon as the scroll passes the halfway point rather than waiting
    // for momentum to end — otherwise the gauge keeps showing the previous
    // card's number for the whole gesture and then jumps when it settles.
    const next = Math.round(event.contentOffset.x / width);
    if (next !== committed.get()) {
      committed.set(next);
      scheduleOnRN(commitIndex, next);
    }
  });

  if (metrics.length === 0) {
    return (
      <Pressable style={styles.card} onPress={() => router.navigate('/logging')}>
        <View style={styles.emptyBody}>
          <ThemedText type="heading" themeColor="onPrimary">
            Set your first goal
          </ThemedText>
          <ThemedText type="small" themeColor="onPrimaryDim">
            Pick what you want to track and it shows up here.
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  const active = metrics[Math.min(index, metrics.length - 1)];
  const display = formatMetric(active, unitSystem);

  return (
    <View style={styles.card}>
      <View style={styles.gaugeSlot} pointerEvents="none">
        <MetricGauge
          progress={display.target > 0 ? display.value / display.target : 0}
          value={display.value}
          unit={display.unit}
          size={GAUGE_SIZE}
        />
      </View>

      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
        {pageWidth > 0 &&
          metrics.map((metric, pageIndex) => (
            <DeckPage
              key={metric.key}
              metric={metric}
              unitSystem={unitSystem}
              pageIndex={pageIndex}
              pageWidth={pageWidth}
              scrollX={scrollX}
            />
          ))}
      </Animated.ScrollView>

      {metrics.length > 1 ? (
        <View style={styles.dots}>
          {metrics.map((metric, dotIndex) => (
            <View key={metric.key} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One page of the deck. The page itself pages normally with the ScrollView;
 * the content inside counter-translates so it travels only TEXT_TRAVEL of that
 * distance, and cross-fades with its neighbour through the middle.
 */
function DeckPage({
  metric,
  unitSystem,
  pageIndex,
  pageWidth,
  scrollX,
}: {
  metric: DashboardMetric;
  unitSystem: UnitSystem;
  pageIndex: number;
  pageWidth: number;
  scrollX: SharedValue<number>;
}) {
  const display = formatMetric(metric, unitSystem);

  const contentStyle = useAnimatedStyle(() => {
    // 0 when this page is centred, ±pageWidth when a neighbour is.
    const distance = pageIndex * pageWidth - scrollX.get();
    return {
      transform: [{ translateX: -distance * (1 - TEXT_TRAVEL) }],
      opacity: interpolate(
        Math.abs(distance),
        [0, pageWidth * FADE_DISTANCE],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <Animated.View style={[styles.pageContent, contentStyle]}>
        <View style={styles.chipRow}>
          <View style={styles.iconCircle}>
            <SymbolView name={iconFor(metric)} size={13} tintColor={colors.primary} />
          </View>
          <ThemedText type="small" themeColor="onPrimaryDim" numberOfLines={1}>
            {metric.label}
          </ThemedText>
        </View>
        <ThemedText type="heading" themeColor="onPrimary">
          {metric.title}
        </ThemedText>
        <ThemedText type="small" themeColor="onPrimaryDim">
          of {formatNumber(display.target)} {display.unit} · {metric.period}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

function iconFor(metric: DashboardMetric): SFSymbol {
  if (metric.metric === 'intake') return INTAKE_ICON;
  if (metric.metric === 'manual') return CHECK_IN_ICON;
  return METRIC_ICONS[metric.metric];
}

/** Water is stored in canonical ounces; everything else displays as logged. */
function formatMetric(metric: DashboardMetric, unitSystem: UnitSystem) {
  if (metric.isVolume) {
    return {
      value: toDisplayVolume(metric.value, unitSystem),
      target: toDisplayVolume(metric.target, unitSystem),
      unit: volumeUnitLabel(unitSystem),
    };
  }
  return { value: Math.round(metric.value), target: Math.round(metric.target), unit: metric.unit };
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    padding: Spacing.three,
    overflow: 'hidden',
  },
  gaugeSlot: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  page: {
    // Reserve the gauge's column so paging text never runs underneath it.
    paddingRight: GAUGE_SIZE + Spacing.three,
    justifyContent: 'center',
    minHeight: GAUGE_SIZE * 0.75,
  },
  pageContent: {
    gap: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: colors.onPrimaryFaint,
  },
  dotActive: {
    backgroundColor: colors.onPrimary,
  },
});
