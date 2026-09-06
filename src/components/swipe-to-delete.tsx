import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Motion, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

const REVEAL_WIDTH = 72;

/**
 * Wraps a row with a left-swipe-to-reveal trash affordance. Hand-rolled with
 * `withTiming` (no springs) rather than the gesture-handler `Swipeable`, to
 * match the app's flat, non-bouncy motion language. The front row's fill is
 * `Colors.background` — the same flat colour the screen sits on — so it fully
 * occludes the red panel underneath until swiped, without needing a card.
 */
export function SwipeToDelete({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      translateX.set(Math.min(0, Math.max(event.translationX, -REVEAL_WIDTH)));
    })
    .onEnd(() => {
      const shouldOpen = translateX.get() < -REVEAL_WIDTH / 2;
      translateX.set(withTiming(shouldOpen ? -REVEAL_WIDTH : 0, { duration: Motion.fast }));
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));

  const confirmDelete = () => {
    haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.deletePanel}>
        <Pressable style={styles.deleteButton} onPress={confirmDelete} hitSlop={8}>
          <SymbolView name="trash.fill" size={18} tintColor={Colors.onPrimary} />
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.front, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  // `flex: 1` on both wrappers so the row content's own `flex: 1` (it expects
  // to fill a definite-height parent, normally the sortable list's fixed-height
  // row slot) still has something to resolve against — without it these two
  // extra auto-sizing layers between that parent and the content break the
  // chain and the whole row collapses to zero height.
  wrap: {
    flex: 1,
    overflow: 'hidden',
  },
  deletePanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: REVEAL_WIDTH,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: Spacing.two,
  },
  front: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
