import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';

const BAR_HEIGHT = 56;

const TAB_ICONS: Record<string, SFSymbol> = {
  dashboard: 'house.fill',
  logging: 'target',
  progress: 'chart.line.uptrend.xyaxis',
  workouts: 'dumbbell',
  settings: 'gearshape',
};

/**
 * Anchored matte tab bar: opaque surface with a thin top border.
 * Active tab is indicated by primaryLight icon/label color.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
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
