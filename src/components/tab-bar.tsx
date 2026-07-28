import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Motion, TabBarHeight } from '@/constants/theme';

const INDICATOR_HEIGHT = 3;
/** Inactive tabs dim by opacity — everything on the lime block is onPrimary. */
const INACTIVE_OPACITY = 0.45;

const TAB_ICONS: Record<string, SFSymbol> = {
  dashboard: 'house.fill',
  logging: 'target',
  nutrition: 'fork.knife',
  progress: 'chart.line.uptrend.xyaxis',
  workouts: 'dumbbell',
  settings: 'gearshape',
};

/**
 * Grounded tab bar: a solid lime block running the full width of the screen,
 * flush to the bottom edge. The active tab is marked by a dark bar on the top
 * edge that slides between tabs — no floating pill, no bubble.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;

  // Shared values (not JS closure state) so the indicator lands correctly on
  // the first layout pass rather than waiting on a re-render.
  const tabWidth = useSharedValue(0);
  const position = useSharedValue(state.index);

  useEffect(() => {
    position.set(withTiming(state.index, { duration: Motion.base }));
  }, [state.index, position]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: tabWidth.get(),
    transform: [{ translateX: position.get() * tabWidth.get() }],
  }));

  return (
    <View
      style={[styles.bar, { height: TabBarHeight + insets.bottom, paddingBottom: insets.bottom }]}
      onLayout={(e) => {
        tabWidth.set(e.nativeEvent.layout.width / tabCount);
      }}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            Haptics.selectionAsync();
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
            style={[styles.tab, !isFocused && styles.tabInactive]}>
            <SymbolView
              name={TAB_ICONS[route.name] ?? 'circle'}
              size={22}
              tintColor={Colors.onPrimary}
            />
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
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
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.primary,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: INDICATOR_HEIGHT,
    backgroundColor: Colors.onPrimary,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabInactive: {
    opacity: INACTIVE_OPACITY,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.onPrimary,
  },
  labelActive: {
    fontFamily: Fonts.bold,
  },
});
