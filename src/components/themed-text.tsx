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
    | 'timer'
    | 'timerSmall'
    | 'numeric';
  themeColor?: ThemeColor;
};

/**
 * Text with the app's type scale (Type in theme.ts). `display`/`title` and
 * `subtitle` speak Fraunces serif; `timer`/`timerSmall`/`numeric` speak DSEG7
 * seven-segment (digits only — use for numbers, not labels). Nest a
 * `displayItalic` inside display copy for the serif-italic emphasis word.
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
        type === 'timer' && styles.timer,
        type === 'timerSmall' && styles.timerSmall,
        type === 'numeric' && styles.numeric,
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
  timer: Type.timerLg,
  timerSmall: Type.timerSm,
  numeric: Type.numeric,
});
