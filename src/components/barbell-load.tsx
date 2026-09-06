import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Colors, Motion, Radius } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { Implement } from '@/lib/plates';

/** Gap between one plate landing and the next. */
export const PLATE_STAGGER_MS = 80;

/** How far above its slot a plate starts before it drops in. */
const PLATE_DROP = 34;
const PLATE_GAP = 2;
/** Bare sleeve left showing outboard of the collar, at the very tip. */
const END_MARGIN = 6;
/**
 * Sleeve share of an olympic bar (16¼" of 84"), so the thicker sleeve segment
 * lands where it does on a real bar rather than wherever the plates end.
 */
const SLEEVE_RATIO = 0.21;
/** Bare grip between the two stacks on a dumbbell — a hand's width. */
const DUMBBELL_GRIP = 44;

/**
 * Two size profiles for one drawing. A dumbbell is a barbell with a short
 * handle and smaller plates — the load animation, haptics and plate scaling
 * are identical, so they share a component rather than duplicating all of it.
 */
type Profile = {
  defaultLength: number;
  shaftThickness: number;
  sleeveThickness: number;
  /** Least bare shaft to leave at the centre before plate widths scale down. */
  minHalfGrip: number;
  plateMinHeight: number;
  plateMaxHeight: number;
  plateMinWidth: number;
  plateMaxWidth: number;
  collarWidth: number;
  collarHeight: number;
};

const PROFILES: Record<Implement, Profile> = {
  barbell: {
    defaultLength: 300,
    shaftThickness: 6,
    sleeveThickness: 11,
    minHalfGrip: 22,
    plateMinHeight: 40,
    plateMaxHeight: 92,
    plateMinWidth: 6,
    plateMaxWidth: 12,
    collarWidth: 5,
    collarHeight: 26,
  },
  dumbbell: {
    defaultLength: 0, // derived from the load; see below.
    shaftThickness: 8,
    sleeveThickness: 13,
    minHalfGrip: 14,
    plateMinHeight: 30,
    plateMaxHeight: 66,
    plateMinWidth: 5,
    plateMaxWidth: 10,
    collarWidth: 4,
    collarHeight: 20,
  },
};

/**
 * The loaded implement behind a PR — a flat near-black silhouette on the lime
 * overlay. Plain Views rather than SVG: it's all rectangles, and per-plate
 * Reanimated styles are far simpler outside an <Svg> tree.
 *
 * Real plates are colour-coded red/blue/yellow/green; that's deliberately not
 * reproduced, since four extra hues would break the one-accent palette.
 * Denomination reads through size instead — a 45 is visibly taller and thicker
 * than a 10.
 *
 * **Each stack is anchored at its end of the bar**, collar outermost, and grows
 * inward as the load does. The earlier layout pinned the plates against a fixed
 * centre shaft, which parked a typical load in the middle of the bar with most
 * of it bare outboard; anchoring outward means 135 lb reads as a loaded bar and
 * only a genuinely heavy load marches in toward the centre. Past the point
 * where the stacks would meet, plate widths scale down to fit rather than
 * plates being dropped. A dumbbell sizes its whole handle to its load instead,
 * so a light one stays stubby.
 *
 * Plates land heaviest-first, one per `PLATE_STAGGER_MS`, each with a light
 * impact.
 */
export function BarbellLoad({
  perSide,
  heaviest,
  variant = 'barbell',
  width,
  startDelay = 0,
}: {
  /** Plate denominations for one side, heaviest first. */
  perSide: number[];
  /** Largest denomination in this unit system, so sizes scale consistently across loads. */
  heaviest: number;
  variant?: Implement;
  /** Overall bar length. Ignored for a dumbbell, whose length follows its load. */
  width?: number;
  startDelay?: number;
}) {
  const profile = PROFILES[variant];
  const sizes = perSide.map((plate) => plateSize(plate, heaviest, profile));
  const naturalStack = stackWidth(sizes, PLATE_GAP, profile);

  // A barbell is a fixed length and the plates fit into it; a dumbbell is
  // whatever length its own plates need plus a grip.
  const barbellLength = width ?? profile.defaultLength;
  const maxStack = barbellLength / 2 - profile.minHalfGrip;
  const scale = variant === 'barbell' && naturalStack > maxStack ? maxStack / naturalStack : 1;
  const stack = naturalStack * scale;
  const barLength = variant === 'barbell' ? barbellLength : 2 * (stack + END_MARGIN) + DUMBBELL_GRIP;
  const sleeveLength = variant === 'barbell' ? barLength * SLEEVE_RATIO : stack + END_MARGIN;

  const outward = [...perSide].reverse();
  const collarStyle = {
    width: profile.collarWidth,
    height: profile.collarHeight,
    borderRadius: Radius.sm,
  };

  return (
    <View style={[styles.container, { width: barLength, height: profile.plateMaxHeight + PLATE_DROP }]}>
      <View
        style={[
          styles.solid,
          styles.bar,
          { width: barLength, height: profile.shaftThickness, borderRadius: profile.shaftThickness / 2 },
        ]}
      />
      <View
        style={[
          styles.solid,
          styles.sleeveLeft,
          { width: sleeveLength, height: profile.sleeveThickness, borderRadius: profile.sleeveThickness / 2 },
        ]}
      />
      <View
        style={[
          styles.solid,
          styles.sleeveRight,
          { width: sleeveLength, height: profile.sleeveThickness, borderRadius: profile.sleeveThickness / 2 },
        ]}
      />
      {/* Both stacks read outward → inward, so each is a plain row anchored at
          its own tip: collar, lightest, … heaviest. */}
      <View style={[styles.side, styles.sideLeft, { gap: PLATE_GAP * scale }]}>
        <View style={[styles.solid, collarStyle]} />
        {outward.map((_, index) => (
          <Plate
            key={`l-${index}`}
            size={sizes[perSide.length - 1 - index]}
            scale={scale}
            delay={startDelay + (outward.length - 1 - index) * PLATE_STAGGER_MS}
          />
        ))}
      </View>
      <View style={[styles.side, styles.sideRight, { gap: PLATE_GAP * scale }]}>
        {perSide.map((_, index) => (
          <Plate
            key={`r-${index}`}
            size={sizes[index]}
            scale={scale}
            delay={startDelay + index * PLATE_STAGGER_MS}
            // Only one side buzzes: both land on the same beat, and two
            // impacts per plate would read as a double-tap.
            haptic
          />
        ))}
        <View style={[styles.solid, collarStyle]} />
      </View>
    </View>
  );
}

/** Collar + plates + the gaps between them, for one side. */
function stackWidth(sizes: { width: number }[], gap: number, profile: Profile): number {
  const plates = sizes.reduce((sum, size) => sum + size.width, 0);
  return profile.collarWidth + plates + gap * sizes.length;
}

/**
 * Square-root scaling so a 2.5 stays visible next to a 45 instead of
 * collapsing to a sliver.
 */
function plateSize(weight: number, heaviest: number, profile: Profile): { width: number; height: number } {
  const ratio = Math.sqrt(Math.min(weight / heaviest, 1));
  return {
    width: profile.plateMinWidth + (profile.plateMaxWidth - profile.plateMinWidth) * ratio,
    height: profile.plateMinHeight + (profile.plateMaxHeight - profile.plateMinHeight) * ratio,
  };
}

function Plate({
  size,
  scale,
  delay,
  haptic,
}: {
  size: { width: number; height: number };
  /** Width-only fit factor: heights are unconstrained, the sleeve is not. */
  scale: number;
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

  return <Animated.View style={[styles.plate, { width: size.width * scale, height: size.height }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { backgroundColor: Colors.onPrimary },
  bar: { position: 'absolute' },
  sleeveLeft: { position: 'absolute', left: 0 },
  sleeveRight: { position: 'absolute', right: 0 },
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideLeft: { left: END_MARGIN },
  sideRight: { right: END_MARGIN },
  plate: {
    borderRadius: Radius.sm,
    backgroundColor: Colors.onPrimary,
  },
});
