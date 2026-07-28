import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, type ThemeColor } from '@/constants/theme';
import { formatDuration } from '@/lib/format';

/**
 * Seven-segment timer readout (DSEG7). Renders `formatDuration(seconds)` over
 * a faint all-segments-lit ghost layer — the classic LCD look. `ticking`
 * pulses the digits on every second change.
 */
export function TimerText({
  seconds,
  size = 'lg',
  ticking = false,
  themeColor,
}: {
  seconds: number;
  size?: 'lg' | 'sm';
  ticking?: boolean;
  themeColor?: ThemeColor;
}) {
  const type = size === 'lg' ? 'timer' : 'timerSmall';
  const display = formatDuration(seconds);
  // Every digit position with all segments lit; ':' keeps its own glyph.
  const ghost = display.replace(/\d/g, '8');

  const scale = useSharedValue(1);
  useEffect(() => {
    if (!ticking) return;
    scale.value = withSequence(
      withTiming(1.04, { duration: 90 }),
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
    );
  }, [seconds, ticking, scale]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={pulseStyle}>
      <View>
        <ThemedText type={type} style={styles.ghost} aria-hidden>
          {ghost}
        </ThemedText>
        <ThemedText type={type} style={themeColor ? undefined : styles.digits} themeColor={themeColor}>
          {display}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: Colors.text,
    opacity: 0.06,
  },
  digits: {
    color: Colors.text,
  },
});
