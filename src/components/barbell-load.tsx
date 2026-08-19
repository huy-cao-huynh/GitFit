import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Colors, Motion, Radius } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

/** Gap between one plate landing and the next. */
export const PLATE_STAGGER_MS = 80;

const BAR_LENGTH = 280;
const BAR_THICKNESS = 6;
/** Bare shaft between the two inner collars. */
const SHAFT_GAP = 64;
const COLLAR_WIDTH = 5;
const COLLAR_HEIGHT = 26;
/** Plate silhouettes — the heaviest denomination reads tallest and thickest. */
const PLATE_MAX_HEIGHT = 92;
const PLATE_MIN_HEIGHT = 40;
const PLATE_MAX_WIDTH = 12;
const PLATE_MIN_WIDTH = 6;
const PLATE_GAP = 2;
/** How far above its slot a plate starts before it drops in. */
const PLATE_DROP = 34;

/**
 * The loaded bar behind a PR — a flat near-black silhouette on the lime
 * overlay. Plain Views rather than SVG: it's all rectangles, and per-plate
 * Reanimated styles are far simpler outside an <Svg> tree.
 *
 * Real plates are colour-coded red/blue/yellow/green; that's deliberately not
 * reproduced, since four extra hues would break the one-accent palette.
 * Denomination reads through size instead — a 45 is visibly taller and thicker
 * than a 10.
 *
 * Plates load inside-out (heaviest against the shaft, collar outermost) and
 * land heaviest-first, one per `PLATE_STAGGER_MS`, each with a light impact.
 * `platesForWeight` caps the count at six a side so this stays a rhythm rather
 * than a buzz.
 */
export function BarbellLoad({
  perSide,
  heaviest,
  startDelay = 0,
}: {
  /** Plate denominations for one side, heaviest first. */
  perSide: number[];
  /** Largest denomination in this unit system, so sizes scale consistently across loads. */
  heaviest: number;
  startDelay?: number;
}) {
  const outward = [...perSide].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.bar} />
      <View style={styles.sleeves}>
        <View style={[styles.side, styles.sideLeft]}>
          <View style={styles.collar} />
          {outward.map((plate, index) => (
            <Plate
              key={`l-${index}`}
              weight={plate}
              heaviest={heaviest}
              delay={startDelay + (outward.length - 1 - index) * PLATE_STAGGER_MS}
            />
          ))}
        </View>
        <View style={[styles.side, styles.sideRight]}>
          {perSide.map((plate, index) => (
            <Plate
              key={`r-${index}`}
              weight={plate}
              heaviest={heaviest}
              delay={startDelay + index * PLATE_STAGGER_MS}
              // Only one side buzzes: both land on the same beat, and two
              // impacts per plate would read as a double-tap.
              haptic
            />
          ))}
          <View style={styles.collar} />
        </View>
      </View>
    </View>
  );
}

function Plate({
  weight,
  heaviest,
  delay,
  haptic,
}: {
  weight: number;
  heaviest: number;
  delay: number;
  haptic?: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, { duration: Motion.fast })));
    if (!haptic) return;
    const timer = setTimeout(() => haptics.impact(), delay);
    return () => clearTimeout(timer);
  }, [delay, haptic, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: -PLATE_DROP * (1 - progress.get()) }],
  }));

  // Square-root scaling so a 2.5 stays visible next to a 45 instead of
  // collapsing to a sliver.
  const ratio = Math.sqrt(Math.min(weight / heaviest, 1));
  const height = PLATE_MIN_HEIGHT + (PLATE_MAX_HEIGHT - PLATE_MIN_HEIGHT) * ratio;
  const width = PLATE_MIN_WIDTH + (PLATE_MAX_WIDTH - PLATE_MIN_WIDTH) * ratio;

  return <Animated.View style={[styles.plate, { width, height }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    width: BAR_LENGTH,
    height: PLATE_MAX_HEIGHT + PLATE_DROP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: BAR_LENGTH,
    height: BAR_THICKNESS,
    borderRadius: BAR_THICKNESS / 2,
    backgroundColor: Colors.onPrimary,
  },
  sleeves: {
    flexDirection: 'row',
    alignItems: 'center',
    width: BAR_LENGTH,
    gap: SHAFT_GAP,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: PLATE_GAP,
  },
  sideLeft: { justifyContent: 'flex-end' },
  sideRight: { justifyContent: 'flex-start' },
  plate: {
    borderRadius: Radius.sm,
    backgroundColor: Colors.onPrimary,
  },
  collar: {
    width: COLLAR_WIDTH,
    height: COLLAR_HEIGHT,
    borderRadius: Radius.sm,
    backgroundColor: Colors.onPrimary,
  },
});
