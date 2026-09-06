import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Wordmark } from '@/components/wordmark';
import { Colors, Motion } from '@/constants/theme';

/**
 * How long the native splash takes to cross-fade out — the root layout feeds
 * this to `SplashScreen.setOptions`, and the reveal waits it out so no part of
 * the animation plays underneath a fading splash. AppIntro's field is the same
 * colour as the splash, so the wait itself is invisible.
 */
export const SPLASH_FADE_MS = 300;
/**
 * Beat to hold the assembled mark before dissolving into the app — long enough
 * to actually read the wordmark, not just glimpse it. Measured from the last
 * letter settling, so this is the only constant that paces the finished mark.
 */
const HOLD_MS = 900;
const WORDMARK_SIZE = 44;

/**
 * The launch brand moment: a flat near-black field — the same colour the
 * native splash holds — with the wordmark assembling on it, then fading to
 * reveal the first screen already laid out underneath.
 *
 * This is the only place the mark animates. It works precisely because the
 * native splash carries no image (see app.json): the reveal starts from the
 * splash's own background colour, so the cross-fade has nothing to ghost
 * against. Putting an image back in the splash config would reintroduce the
 * double-drawn-logo flash this arrangement exists to avoid.
 *
 * The letters leave the same way they arrived — staggered left to right —
 * rather than the whole mark cross-fading as one block; only once the last
 * letter has gone does the (now-empty) container do its own quick fade, so
 * the halftone background underneath still arrives as a soft cross-fade
 * instead of a hard cut.
 */
export function AppIntro({ onFinished }: { onFinished: () => void }) {
  const fade = useSharedValue(1);
  const [exiting, setExiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginExit = useCallback(() => {
    timer.current = setTimeout(() => setExiting(true), HOLD_MS);
  }, []);

  const finishExit = useCallback(() => {
    fade.set(withTiming(0, { duration: Motion.fast }));
    timer.current = setTimeout(onFinished, Motion.fast);
  }, [fade, onFinished]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: fade.get() }));

  return (
    // No pointerEvents="none": the intro absorbs taps so nothing on the screen
    // beneath it can be hit before it's actually visible.
    <Animated.View style={[styles.container, style]}>
      <Wordmark
        size={WORDMARK_SIZE}
        animate
        delay={SPLASH_FADE_MS}
        onDone={beginExit}
        exit={exiting}
        onExitDone={finishExit}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
