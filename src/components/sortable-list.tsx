/* eslint-disable react-hooks/immutability -- reanimated shared values are
   mutated inside gesture worklets, which run on the UI thread, not in render */
import { SymbolView } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors, Motion, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

const REORDER_TIMING = { duration: Motion.fast };

interface SortableListProps<T> {
  items: T[];
  keyFor: (item: T) => string;
  rowHeight: number;
  /** `dragHandle` is a ready-to-place drag affordance — render it inside your own row container rather than beside it. */
  renderRow: (item: T, dragHandle: ReactNode) => ReactNode;
  /** Called with the item keys in their new order after a drag ends. */
  onOrderChange: (orderedKeys: string[]) => void;
}

/**
 * Drag-handle reorderable list for short, non-scrolling lists (the session
 * queue). Rows are absolutely positioned and animate to their slot.
 */
export function SortableList<T>({ items, keyFor, rowHeight, renderRow, onOrderChange }: SortableListProps<T>) {
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(items.map((item, index) => [keyFor(item), index])),
  );

  useEffect(() => {
    positions.value = Object.fromEntries(items.map((item, index) => [keyFor(item), index]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const commit = () => {
    const orderedKeys = Object.entries(positions.value)
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => key);
    onOrderChange(orderedKeys);
  };

  return (
    <View style={{ height: items.length * rowHeight }}>
      {items.map((item, index) => (
        <SortableRow
          key={keyFor(item)}
          id={keyFor(item)}
          initialIndex={index}
          positions={positions}
          rowHeight={rowHeight}
          count={items.length}
          onCommit={commit}>
          {(dragHandle) => renderRow(item, dragHandle)}
        </SortableRow>
      ))}
    </View>
  );
}

function SortableRow({
  id,
  initialIndex,
  positions,
  rowHeight,
  count,
  onCommit,
  children,
}: {
  id: string;
  initialIndex: number;
  positions: SharedValue<Record<string, number>>;
  rowHeight: number;
  count: number;
  onCommit: () => void;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const isActive = useSharedValue(false);
  const startY = useSharedValue(0);
  const translateY = useSharedValue(initialIndex * rowHeight);

  useAnimatedReaction(
    () => positions.value[id],
    (position) => {
      if (position === undefined || isActive.value) return;
      translateY.value = withTiming(position * rowHeight, REORDER_TIMING);
    },
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      isActive.value = true;
      startY.value = (positions.value[id] ?? 0) * rowHeight;
      scheduleOnRN(haptics.selection);
    })
    .onUpdate((event) => {
      const y = startY.value + event.translationY;
      translateY.value = y;
      const newIndex = Math.min(count - 1, Math.max(0, Math.round(y / rowHeight)));
      const oldIndex = positions.value[id];
      if (newIndex === oldIndex) return;
      const next = { ...positions.value };
      for (const key in next) {
        if (key !== id && next[key] === newIndex) {
          next[key] = oldIndex;
          break;
        }
      }
      next[id] = newIndex;
      positions.value = next;
      scheduleOnRN(haptics.selection);
    })
    .onEnd(() => {
      isActive.value = false;
      translateY.value = withTiming((positions.value[id] ?? 0) * rowHeight, REORDER_TIMING);
      scheduleOnRN(onCommit);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isActive.value ? 10 : 0,
  }));

  const dragHandle = (
    <GestureDetector gesture={pan}>
      <View style={styles.handle} hitSlop={8}>
        <SymbolView name="line.3.horizontal" size={18} tintColor={Colors.textSecondary} />
      </View>
    </GestureDetector>
  );

  return <Animated.View style={[styles.row, { height: rowHeight }, animatedStyle]}>{children(dragHandle)}</Animated.View>;
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  handle: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
