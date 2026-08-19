import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { Colors, Type } from '@/constants/theme';

/**
 * Count-up stat number in the serif stat face (tabular figures, so the layout
 * doesn't jitter while animating). Animates to `value` on mount and on every
 * change. `suffix` is appended un-animated (e.g. " oz"). This is a stat, not a
 * clock — the DSEG timer face is reserved for live workout/cardio timers.
 *
 * Driven from JS rather than Reanimated on purpose. The usual trick — an
 * animated `text` prop on a TextInput — writes through to the native view
 * without re-running layout, so the box stays the width of whatever React last
 * rendered ("0", one character) and every value past the first digit is
 * clipped until something else forces a re-measure. Rendering a real <Text>
 * keeps measurement correct at every intermediate value. It's one number
 * animating for a few hundred ms, so the per-frame render is cheap.
 */
export function AnimatedNumber({
  value,
  suffix = '',
  duration = 800,
  grouped = false,
  decimals = 0,
  from = 0,
  delay = 0,
  style,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  /** Insert thousands separators ("2,000"). */
  grouped?: boolean;
  /** Fixed decimal places (e.g. 1 for "1.4"). Counts up in fractional steps too. */
  decimals?: number;
  /** Value to start the first count from — e.g. the record being beaten. Mount-time only. */
  from?: number;
  /** Hold the first count for this long, so it can land on a beat in a longer sequence. */
  delay?: number;
  style?: StyleProp<TextStyle>;
}) {
  const scale = 10 ** decimals;
  const initial = Math.round(from * scale);
  const [display, setDisplay] = useState(initial);
  // What's on screen right now, so an animation interrupted mid-count resumes
  // from where it visually is instead of snapping back. Stored at `decimals`
  // precision (scaled to an integer) so fractional targets count up smoothly.
  const shown = useRef(initial);
  // Only the first count waits — a later value change should retarget at once.
  const delayed = useRef(delay);

  useEffect(() => {
    const target = Math.round(value * scale);
    const from = shown.current;
    if (from === target) return;

    const wait = delayed.current;
    delayed.current = 0;
    const start = Date.now() + wait;
    let frame: ReturnType<typeof requestAnimationFrame>;

    const tick = () => {
      const t = Math.min(1, Math.max(0, Date.now() - start) / duration);
      // Ease-out cubic, matching the previous withTiming easing.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      shown.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, scale]);

  return (
    <Text style={[styles.number, style]}>
      {formatCount(display, grouped, scale)}
      {suffix}
    </Text>
  );
}

/** Thousands separators without depending on Intl/toLocaleString; unscales fixed-point display values. */
function formatCount(scaledValue: number, grouped: boolean, scale: number): string {
  const negative = scaledValue < 0;
  const absolute = Math.abs(scaledValue);
  const wholeDigits = String(Math.trunc(absolute / scale));
  const fraction = scale > 1 ? String(absolute % scale).padStart(String(scale - 1).length, '0') : '';

  let whole = wholeDigits;
  if (grouped && wholeDigits.length >= 4) {
    whole = '';
    for (let i = 0; i < wholeDigits.length; i++) {
      const fromEnd = wholeDigits.length - i;
      whole += wholeDigits[i];
      if (fromEnd > 1 && fromEnd % 3 === 1) whole += ',';
    }
  }

  const out = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${out}` : out;
}

const styles = {
  number: {
    ...Type.statMd,
    color: Colors.text,
  } as TextStyle,
};
