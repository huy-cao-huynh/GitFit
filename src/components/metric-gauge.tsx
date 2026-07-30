import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Colors, Motion, Type } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Smallest sweep the arc ever animates to. The round linecap turns it into a
 * black dot at the arc's start, so an empty metric still shows where progress
 * begins — and the path never unmounts, which is what used to pop when a
 * metric crossed zero.
 */
const MIN_SWEEP = 0.004;

/**
 * Half-circle progress gauge for the dashboard metric deck. It only ever sits
 * on a lime card, so the track is white and the progress sweep is near-black —
 * the inverse of the rest of the app's charts. The value counts up inside the
 * arc's opening and the unit fades whenever the metric changes.
 */
export function MetricGauge({
  progress,
  value,
  unit,
  size = 132,
  strokeWidth = 14,
}: {
  progress: number;
  value: number;
  unit: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  // Only the top half of the circle is drawn, so the SVG stops just below the
  // diameter line — the value then sits in the space the arc encloses.
  const arcHeight = center + strokeWidth / 2;
  const arcLength = Math.PI * radius;
  const swept = Math.max(Math.min(Math.max(progress, 0), 1), MIN_SWEEP);

  const d = `M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`;

  const animatedProgress = useSharedValue(swept);
  const unitOpacity = useSharedValue(1);

  useEffect(() => {
    animatedProgress.set(withTiming(swept, { duration: Motion.slow }));
  }, [swept, animatedProgress]);

  useEffect(() => {
    // Snap out, ease in — the unit swaps outright when the metric changes, so
    // it fades rather than popping to a different word.
    unitOpacity.set(0);
    unitOpacity.set(withTiming(1, { duration: Motion.base }));
  }, [unit, unitOpacity]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - animatedProgress.get()),
  }));

  const unitStyle = useAnimatedStyle(() => ({ opacity: unitOpacity.get() }));

  return (
    <View style={[styles.container, { width: size, height: arcHeight }]}>
      <Svg width={size} height={arcHeight}>
        <Path d={d} fill="none" stroke={Colors.text} strokeWidth={strokeWidth} strokeLinecap="round" />
        <AnimatedPath
          d={d}
          fill="none"
          stroke={Colors.onPrimary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - swept)}
          animatedProps={animatedProps}
        />
      </Svg>
      {/* Stacked, not inline: units like "workouts" are long enough that a
          single row would push out past the arc it's meant to sit inside. */}
      <View style={[styles.readout, { maxWidth: radius * 1.7 }]}>
        <AnimatedNumber
          grouped
          value={value}
          duration={400}
          style={[styles.value, { fontSize: valueFontSize(value) }]}
        />
        {unit ? (
          <Animated.View style={unitStyle}>
            <ThemedText type="caption" themeColor="onPrimaryDim" numberOfLines={1}>
              {unit}
            </ThemedText>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Step the size down by magnitude so long values stay inside the arc. Chosen in
 * JS rather than via `adjustsFontSizeToFit` so the size is stable for a given
 * metric instead of shifting frame to frame while the value counts up.
 */
function valueFontSize(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude >= 10000) return 22;
  if (magnitude >= 1000) return 26;
  return Type.statMd.fontSize;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
  },
  readout: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 0,
    alignItems: 'center',
  },
  value: {
    color: Colors.onPrimary,
    textAlign: 'center',
  },
});
