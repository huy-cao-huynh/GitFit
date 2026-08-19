import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { WORDMARK, WORDMARK_PARTS, WORDMARK_TRACKING } from '@/constants/brand';
import { Colors, Fonts, Motion } from '@/constants/theme';

const STAGGER_MS = 45;
/** How far each letter rises into place. */
const RISE = 8;

/**
 * The GitFit wordmark — "Git" in white, "Fit" in lime. This is the app's only
 * brand element; there is no logo glyph.
 *
 * Unlike every other text in the app this sets fontFamily and fontSize
 * directly rather than taking a `Type` token: a brand mark scales to whatever
 * surface it sits on (40 on login, larger on the launch intro) and its
 * tracking is proportional to its size, so the fixed type scale doesn't apply.
 *
 * With `animate`, plays a one-shot staggered letter rise with the "Fit" half
 * sweeping from grey to lime as it settles — the app's opening animation,
 * owned by `AppIntro`. Every other render site passes `animate={false}`, since
 * replaying the reveal on a screen that appears right after the intro reads as
 * a stutter, not a flourish.
 *
 * Letters are separate Views in a row rather than nested <Text> nodes: a
 * transform on a Text nested inside another Text doesn't reliably apply on
 * iOS, so the rise would silently no-op.
 */
export function Wordmark({
  size = 32,
  animate = false,
  delay = 0,
  onDone,
}: {
  size?: number;
  /** Play the staggered reveal. Off by default — only the launch intro animates. */
  animate?: boolean;
  /** Hold before the first letter starts. */
  delay?: number;
  /** Fires once the last letter has settled. */
  onDone?: () => void;
}) {
  const letters = [
    ...[...WORDMARK_PARTS.neutral].map((char) => ({ char, accent: false })),
    ...[...WORDMARK_PARTS.accent].map((char) => ({ char, accent: true })),
  ];
  const tracking = size * WORDMARK_TRACKING;
  const textStyle = { fontSize: size, lineHeight: size * 1.15, letterSpacing: tracking };

  return (
    <View style={styles.mark} accessibilityRole="header" accessibilityLabel={WORDMARK}>
      {letters.map((letter, index) => (
        <AnimatedLetter
          key={index}
          char={letter.char}
          accent={letter.accent}
          animate={animate}
          delay={delay + index * STAGGER_MS}
          onDone={index === letters.length - 1 ? onDone : undefined}
          // The last letter still carries a trailing tracking gap it has no
          // neighbour for, which would pull the row off-centre; cancel it.
          style={[textStyle, index === letters.length - 1 ? { marginRight: -tracking } : null]}
        />
      ))}
    </View>
  );
}

function AnimatedLetter({
  char,
  accent,
  animate,
  delay,
  onDone,
  style,
}: {
  char: string;
  accent: boolean;
  animate: boolean;
  delay: number;
  onDone?: () => void;
  style: StyleProp<TextStyle>;
}) {
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    const finish = onDone;
    progress.set(
      withDelay(
        delay,
        withTiming(1, { duration: Motion.base }, (done) => {
          if (done && finish) runOnJS(finish)();
        }),
      ),
    );
  }, [animate, delay, onDone, progress]);

  const viewStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: RISE * (1 - progress.get()) }],
  }));

  const textColorStyle = useAnimatedStyle(() => ({
    color: accent
      ? interpolateColor(progress.get(), [0, 1], [Colors.textSecondary, Colors.primary])
      : Colors.text,
  }));

  return (
    <Animated.View style={viewStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.Text style={[styles.letter, style, textColorStyle]}>{char}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letter: {
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
});
