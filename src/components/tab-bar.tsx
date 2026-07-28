import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Motion, Radius, Spacing } from '@/constants/theme';

const BAR_HEIGHT = 64;
const PILL_INSET = Spacing.two;

const TAB_ICONS: Record<string, SFSymbol> = {
  dashboard: 'house.fill',
  logging: 'target',
  nutrition: 'fork.knife',
  progress: 'chart.line.uptrend.xyaxis',
  workouts: 'dumbbell',
  settings: 'gearshape',
};

/**
 * Floating pill tab bar: detached from the screen edges, fully rounded, with
 * a surfaceElevated pill that slides behind the active tab.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const tabCount = state.routes.length;
  const tabWidth = barWidth > 0 ? (barWidth - PILL_INSET * 2) / tabCount : 0;

  const position = useSharedValue(state.index);
  useEffect(() => {
    position.value = withTiming(state.index, { duration: Motion.base });
  }, [state.index, position]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: PILL_INSET + position.value * tabWidth }],
  }));

  return (
    <View style={[styles.bar, { bottom: Math.max(insets.bottom, Spacing.three) }]}>
      <View style={styles.pillTrack} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {tabWidth > 0 ? (
          <Animated.View style={[styles.pill, { width: tabWidth }, pillStyle]} />
        ) : null}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;
          const color = isFocused ? Colors.primaryLight : Colors.textMuted;

          const onPress = () => {
            Haptics.selectionAsync();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              style={styles.tab}>
              <SymbolView name={TAB_ICONS[route.name] ?? 'circle'} size={22} tintColor={color} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    height: BAR_HEIGHT,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pillTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
  },
  tab: {
    height: BAR_HEIGHT,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },
});
