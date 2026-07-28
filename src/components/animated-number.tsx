import { useEffect } from 'react';
import { TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Type } from '@/constants/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Count-up stat number in the serif stat face (tabular figures, so the layout
 * doesn't jitter while animating). Animates to `value` on mount and on every
 * change. `suffix` is appended un-animated (e.g. " oz"). This is a stat, not a
 * clock — the DSEG timer face is reserved for live workout/cardio timers.
 */
export function AnimatedNumber({
  value,
  suffix = '',
  duration = 800,
  style,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, duration, progress]);

  const animatedProps = useAnimatedProps(() => {
    const text = `${Math.round(progress.value)}${suffix}`;
    // `text` drives the native input's content via setNativeProps; it isn't
    // part of TextInputProps, so widen the type for the animatedProps plumbing.
    return { text } as unknown as TextInputProps;
  });

  return (
    <AnimatedTextInput
      editable={false}
      defaultValue={`0${suffix}`}
      animatedProps={animatedProps}
      style={[styles.number, style]}
    />
  );
}

const styles = {
  number: {
    ...Type.statMd,
    color: Colors.text,
    padding: 0,
  } as TextStyle,
};
