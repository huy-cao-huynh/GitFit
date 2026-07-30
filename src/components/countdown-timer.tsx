import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { TimerText } from '@/components/timer-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 160;
const STROKE_WIDTH = 8;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular countdown for work/rest intervals. Completion is wall-clock based
 * (a 250 ms poll against an end timestamp, immune to background drift); the
 * ring itself is one linear reanimated timing over the full duration, so it
 * sweeps smoothly instead of stepping. Haptic choreography: a nudge at 10 s
 * remaining, ticks through 3-2-1, success at zero.
 */
export function CountdownTimer({
  seconds,
  label,
  nextLabel,
  onDone,
  skippable,
}: {
  seconds: number;
  label: string;
  nextLabel?: string;
  onDone: () => void;
  skippable?: boolean;
}) {
  const endsAt = useRef<number | null>(null);
  const called = useRef(false);
  const lastHaptic = useRef<number | null>(null);
  const [remaining, setRemaining] = useState(seconds);

  const progress = useSharedValue(1);
  useEffect(() => {
    progress.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
  }, [seconds, progress]);

  useEffect(() => {
    endsAt.current ??= Date.now() + seconds * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil(((endsAt.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left !== lastHaptic.current) {
        if (left === 10 && seconds >= 20) {
          haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
          lastHaptic.current = left;
        } else if (left >= 1 && left <= 3) {
          haptics.selection();
          lastHaptic.current = left;
        }
      }
      if (left === 0 && !called.current) {
        called.current = true;
        clearInterval(interval);
        haptics.notification(Haptics.NotificationFeedbackType.Success);
        onDone();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [onDone, seconds]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={styles.timerArea}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} style={styles.ring}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={Colors.border}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={Colors.primary}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ringProps}
          />
        </Svg>
        <View style={styles.timerLabel}>
          <TimerText seconds={remaining} size="sm" />
        </View>
      </View>
      {nextLabel ? (
        <ThemedText type="small" themeColor="textSecondary">
          Up next: {nextLabel}
        </ThemedText>
      ) : null}
      {skippable ? (
        <Pressable style={styles.skipButton} onPress={onDone}>
          <ThemedText type="smallBold" style={{ color: Colors.primaryLight }}>
            Skip Rest
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  timerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  ring: {
    transform: [{ rotate: '-90deg' }],
  },
  timerLabel: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
  },
});
