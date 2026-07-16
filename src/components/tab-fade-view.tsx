import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

import { Motion } from '@/constants/theme';

interface TabFadeViewProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function TabFadeView({ children, style }: TabFadeViewProps) {
  const [opacity] = useState(() => new Animated.Value(1));

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: Motion.fast,
        useNativeDriver: true,
      }).start();
    }, [opacity]),
  );

  return <Animated.View style={[styles.container, style, { opacity }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
