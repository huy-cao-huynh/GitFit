import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Spacing } from '@/constants/theme';

const BAR_HEIGHT = 60;
const INDICATOR_WIDTH = 52;
const INDICATOR_HEIGHT = 44;
const SPRING = { damping: 18, stiffness: 180 };

const TAB_ICONS: Record<string, SFSymbol> = {
  dashboard: 'house.fill',
  history: 'clock',
  progress: 'chart.line.uptrend.xyaxis',
  workouts: 'dumbbell',
  settings: 'gearshape',
};

/**
 * Floating dark pill replacing the native tab bar, with a periwinkle
 * indicator that springs between tabs.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(-INDICATOR_WIDTH);
  const cellWidth = barWidth > 0 ? barWidth / state.routes.length : 0;

  useEffect(() => {
    if (cellWidth === 0) return;
    const target = state.index * cellWidth + (cellWidth - INDICATOR_WIDTH) / 2;
    // First layout jumps into place; later changes spring.
    indicatorX.value = indicatorX.value < 0 ? target : withSpring(target, SPRING);
  }, [state.index, cellWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View style={[styles.bar, { bottom: insets.bottom + Spacing.two }]} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
      {barWidth > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;
        const color = isFocused ? Colors.accent : Colors.textSecondary;

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
    left: Spacing.four,
    right: Spacing.four,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: 'rgba(20,17,30,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    top: (BAR_HEIGHT - INDICATOR_HEIGHT) / 2,
    backgroundColor: Colors.backgroundSelected,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },
});
