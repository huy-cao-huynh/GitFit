import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts, ThemeColor, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'display'
    | 'displayItalic'
    | 'heading'
    | 'label'
    | 'button'
    | 'stat'
    | 'statLarge'
    | 'statSmall'
    | 'statInline'
    | 'timer'
    | 'timerSmall';
  themeColor?: ThemeColor;
};

/**
 * Text with the app's type scale (Type in theme.ts). Three voices with strict
 * jobs: `display`/`title`/`subtitle`/`heading` and the `stat*` numerals speak
 * Fraunces serif; `timer`/`timerSmall` speak DSEG7 and are reserved for live
 * workout/cardio timers and in-session distance; everything else is Manrope.
 * Nest a `displayItalic` inside display copy for the serif-italic emphasis word.
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'display' && styles.display,
        type === 'displayItalic' && styles.displayItalic,
        type === 'heading' && styles.heading,
        type === 'label' && styles.label,
        type === 'button' && styles.button,
        type === 'stat' && styles.stat,
        type === 'statLarge' && styles.statLarge,
        type === 'statSmall' && styles.statSmall,
        type === 'statInline' && styles.statInline,
        type === 'timer' && styles.timer,
        type === 'timerSmall' && styles.timerSmall,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: Type.small,
  smallBold: {
    ...Type.small,
    fontFamily: Fonts.bold,
  },
  default: Type.body,
  title: Type.display,
  subtitle: Type.title,
  link: {
    fontFamily: Fonts.medium,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: Fonts.semibold,
    lineHeight: 30,
    fontSize: 14,
    color: Colors.primaryLight,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  display: Type.display,
  displayItalic: {
    ...Type.display,
    fontFamily: Fonts.displayItalic,
  },
  heading: Type.heading,
  label: Type.label,
  button: Type.button,
  stat: Type.statMd,
  statLarge: Type.statLg,
  statSmall: Type.statSm,
  statInline: Type.statXs,
  timer: Type.timerLg,
  timerSmall: Type.timerSm,
});
