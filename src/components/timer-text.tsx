import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, type ThemeColor } from '@/constants/theme';
import { formatDuration } from '@/lib/format';

/**
 * Seven-segment timer readout (DSEG7). Renders `formatDuration(seconds)` over
 * a faint all-segments-lit ghost layer — the classic LCD look.
 */
export function TimerText({
  seconds,
  size = 'lg',
  themeColor,
}: {
  seconds: number;
  size?: 'lg' | 'sm' | 'xs';
  themeColor?: ThemeColor;
}) {
  const type = size === 'lg' ? 'timer' : size === 'sm' ? 'timerSmall' : 'timerXs';
  const display = formatDuration(seconds);
  // Every digit position with all segments lit; ':' keeps its own glyph.
  const ghost = display.replace(/\d/g, '8');

  return (
    <View>
      <ThemedText type={type} style={styles.ghost} aria-hidden>
        {ghost}
      </ThemedText>
      <ThemedText type={type} style={themeColor ? undefined : styles.digits} themeColor={themeColor}>
        {display}
      </ThemedText>
    </View>
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
