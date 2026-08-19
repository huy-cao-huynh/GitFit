import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedNumber } from '@/components/animated-number';
import { BarbellLoad, PLATE_STAGGER_MS } from '@/components/barbell-load';
import { ThemedText } from '@/components/themed-text';
import { Colors, Motion, Spacing, Type } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { platesForWeight } from '@/lib/plates';
import type { UnitSystem } from '@/lib/store/types';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';

export interface PRRecord {
  name: string;
  /** Canonical lbs, as stored. */
  weight: number;
  reps?: number;
  /** The record being beaten, canonical lbs. Absent on a first-ever lift. */
  priorWeight?: number;
}

/** Panel wipe up from the bottom edge. */
const WIPE_MS = Motion.slow;
/** Eyebrow + bare bar fade in just behind the wipe. */
const CONTENT_DELAY = 220;
/** First plate lands, and the number starts climbing off the old record. */
const LOAD_DELAY = 320;
const NUMBER_MS = 800;
const AXIS_DELAY = 880;
/** Beat to sit on once everything has landed, before auto-dismissing. */
const HOLD_MS = 560;

/**
 * The PR moment: a lime panel wipes up from the bottom edge and a barbell
 * loads itself plate by plate while the weight counts up off the old record,
 * landing on a marker that slides past it.
 *
 * Auto-dismisses. A heavy session can PR on several exercises, and a blocking
 * "tap to continue" turns the payoff into an interruption; a tap anywhere
 * skips straight to the fade-out instead.
 */
export function PRCelebration({
  celebration,
  unitSystem,
  onDismiss,
}: {
  celebration: PRRecord | null;
  unitSystem: UnitSystem;
  onDismiss: () => void;
}) {
  if (!celebration) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      {/* Keyed on the lift itself: a second PR must replay from the start
          rather than reuse shared values already sitting at their end state. */}
      <PRCelebrationBody
        key={`${celebration.name}-${celebration.weight}-${celebration.reps ?? ''}`}
        celebration={celebration}
        unitSystem={unitSystem}
        onDismiss={onDismiss}
      />
    </Modal>
  );
}

function PRCelebrationBody({
  celebration,
  unitSystem,
  onDismiss,
}: {
  celebration: PRRecord;
  unitSystem: UnitSystem;
  onDismiss: () => void;
}) {
  const { height } = useWindowDimensions();
  const unit = weightUnitLabel(unitSystem);
  const displayWeight = toDisplayWeight(celebration.weight, unitSystem);
  const displayPrior =
    celebration.priorWeight === undefined ? null : toDisplayWeight(celebration.priorWeight, unitSystem);
  const load = platesForWeight(celebration.weight, unitSystem);
  const heaviest = load.perSide[0] ?? 1;
  const whole = displayWeight % 1 === 0 && (displayPrior ?? 0) % 1 === 0;

  // When everything has landed: the slowest of the count-up, the axis marker,
  // and the last plate.
  const peakMs = Math.max(
    LOAD_DELAY + NUMBER_MS,
    AXIS_DELAY + Motion.slow,
    LOAD_DELAY + load.perSide.length * PLATE_STAGGER_MS + Motion.fast,
  );

  const wipe = useSharedValue(height);
  const fade = useSharedValue(1);
  const content = useSharedValue(0);
  const dismissed = useRef(false);
  // One list, never reassigned, so the unmount cleanup always sees every timer
  // — including the one `finish` adds for the delayed onDismiss.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * `onDismiss` advances the workout's phase machine, so it must fire exactly
   * once: `dismissed` guards the race between the auto-dismiss timer and a
   * late tap.
   */
  const finish = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    timers.current.forEach(clearTimeout);
    timers.current.length = 0;
    fade.set(withTiming(0, { duration: Motion.slow }));
    timers.current.push(setTimeout(onDismiss, Motion.slow));
  }, [fade, onDismiss]);

  useEffect(() => {
    const scheduled = timers.current;
    wipe.set(withTiming(0, { duration: WIPE_MS, easing: Easing.out(Easing.quad) }));
    content.set(withDelay(CONTENT_DELAY, withTiming(1, { duration: Motion.base })));
    scheduled.push(setTimeout(() => haptics.notification(Haptics.NotificationFeedbackType.Success), peakMs));
    scheduled.push(setTimeout(finish, peakMs + HOLD_MS));
    return () => {
      scheduled.forEach(clearTimeout);
      scheduled.length = 0;
    };
  }, [content, finish, peakMs, wipe]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: wipe.get() }],
  }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.get() }));

  return (
    <Animated.View style={[styles.panel, panelStyle]}>
      <Pressable style={styles.flex} onPress={finish} accessibilityLabel="Skip celebration">
        <SafeAreaView style={styles.flex}>
          <Animated.View style={[styles.content, contentStyle]}>
            <ThemedText type="label" style={styles.dim}>
              {displayPrior === null ? 'FIRST LIFT' : 'PERSONAL RECORD'}
            </ThemedText>

            {load.isBarbell ? (
              <BarbellLoad perSide={load.perSide} heaviest={heaviest} startDelay={LOAD_DELAY - CONTENT_DELAY} />
            ) : null}

            <View style={styles.readout}>
              <AnimatedNumber
                value={displayWeight}
                from={displayPrior ?? 0}
                delay={LOAD_DELAY - CONTENT_DELAY}
                duration={NUMBER_MS}
                decimals={whole ? 0 : 1}
                style={styles.weight}
              />
              <ThemedText type="stat" style={styles.unitLabel}>
                {unit}
              </ThemedText>
            </View>

            {celebration.reps === undefined ? null : (
              <ThemedText type="small" style={styles.dim}>
                × {celebration.reps} reps
              </ThemedText>
            )}

            {displayPrior === null ? null : <RecordAxis prior={displayPrior} next={displayWeight} unit={unit} />}

            <ThemedText type="label" style={styles.name}>
              {celebration.name.toUpperCase()}
            </ThemedText>
          </Animated.View>

          <Animated.View style={[styles.skip, contentStyle]}>
            <ThemedText type="caption" style={styles.dim}>
              Tap to skip
            </ThemedText>
          </Animated.View>
        </SafeAreaView>
      </Pressable>
    </Animated.View>
  );
}

/**
 * A rule from zero to the new record, with a faint tick where the old one sat
 * and a solid marker that slides out past it. Positioned in percentages, so it
 * needs no layout measurement.
 */
function RecordAxis({ prior, next, unit }: { prior: number; next: number; unit: string }) {
  const priorFraction = next > 0 ? Math.min(prior / next, 1) : 0;
  const travel = useSharedValue(0);

  useEffect(() => {
    travel.set(withDelay(AXIS_DELAY, withTiming(1, { duration: Motion.slow, easing: Easing.out(Easing.quad) })));
  }, [travel]);

  // A transform rather than an animated `left`: position is a layout prop, and
  // keeping the moving part on the transform keeps it off the layout pass.
  const markerStyle = useAnimatedStyle(() => {
    const fraction = priorFraction + (1 - priorFraction) * travel.get();
    return { transform: [{ translateX: fraction * AXIS_WIDTH }] };
  });
  const deltaStyle = useAnimatedStyle(() => ({ opacity: travel.get() }));

  const delta = Math.round((next - prior) * 10) / 10;

  return (
    <View style={styles.axis}>
      <View style={styles.axisRule} />
      <View style={[styles.axisTick, styles.axisTickPrior, { transform: [{ translateX: priorFraction * AXIS_WIDTH }] }]} />
      <Animated.View style={[styles.axisTick, markerStyle]} />
      <View style={styles.axisLabels}>
        <ThemedText type="caption" style={styles.dim}>
          was {prior} {unit}
        </ThemedText>
        <Animated.View style={deltaStyle}>
          <ThemedText type="caption" style={styles.delta}>
            ▲ +{delta} {unit}
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
}

/** Fixed so the marker can travel on a transform instead of a percentage. */
const AXIS_WIDTH = 280;
const AXIS_RULE_HEIGHT = 2;
const AXIS_TICK_WIDTH = 3;
const AXIS_TICK_HEIGHT = 18;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  weight: {
    ...Type.statLg,
    color: Colors.onPrimary,
  },
  unitLabel: {
    color: Colors.onPrimaryDim,
  },
  dim: {
    color: Colors.onPrimaryDim,
    textAlign: 'center',
  },
  name: {
    color: Colors.onPrimary,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  axis: {
    width: AXIS_WIDTH,
    marginTop: Spacing.four,
  },
  axisRule: {
    height: AXIS_RULE_HEIGHT,
    borderRadius: AXIS_RULE_HEIGHT / 2,
    backgroundColor: Colors.onPrimaryFaint,
  },
  axisTick: {
    position: 'absolute',
    left: 0,
    top: -(AXIS_TICK_HEIGHT - AXIS_RULE_HEIGHT) / 2,
    width: AXIS_TICK_WIDTH,
    height: AXIS_TICK_HEIGHT,
    marginLeft: -AXIS_TICK_WIDTH / 2,
    borderRadius: AXIS_TICK_WIDTH / 2,
    backgroundColor: Colors.onPrimary,
  },
  axisTickPrior: {
    backgroundColor: Colors.onPrimaryDim,
  },
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
  },
  delta: {
    color: Colors.onPrimary,
  },
  skip: {
    alignItems: 'center',
    paddingBottom: Spacing.four,
  },
});
