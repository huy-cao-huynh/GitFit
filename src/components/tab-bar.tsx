import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Motion, Radius } from '@/constants/theme';

const BAR_HEIGHT = 56;
const INDICATOR_WIDTH = 64;
const INDICATOR_HEIGHT = 44;
const SLIDE = { duration: Motion.base };

const TAB_ICONS: Record<string, SFSymbol> = {
  dashboard: 'house.fill',
  logging: 'target',
  progress: 'chart.line.uptrend.xyaxis',
  workouts: 'dumbbell',
  settings: 'gearshape',
};

/**
 * Anchored matte tab bar: opaque surface with a thin top border and a subtle
 * elevated pill that slides behind the active tab.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(-INDICATOR_WIDTH);
  const cellWidth = barWidth > 0 ? barWidth / state.routes.length : 0;

  useEffect(() => {
    if (cellWidth === 0) return;
    const target = state.index * cellWidth + (cellWidth - INDICATOR_WIDTH) / 2;
    // First layout jumps into place; later changes glide without bounce.
    indicatorX.value = indicatorX.value < 0 ? target : withTiming(target, SLIDE);
  }, [state.index, cellWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={[styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
      {barWidth > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;
        const color = isFocused ? Colors.primaryLight : Colors.textMuted;

        const onPress = () => {
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
            <SymbolView
              name={TAB_ICONS[route.name] ?? 'circle'}
              size={22}
              tintColor={color}
            />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: Radius.md,
    top: (BAR_HEIGHT - INDICATOR_HEIGHT) / 2,
    backgroundColor: Colors.surfaceElevated,
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
