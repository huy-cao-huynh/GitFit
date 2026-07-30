import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

interface Scrollable {
  scrollTo?: (options: { y: number; animated: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated: boolean }) => void;
}

/** Resets a ScrollView/FlatList to the top whenever its tab regains focus, instead of preserving the last scroll position. */
export function useResetScrollOnFocus<T extends Scrollable>() {
  const ref = useRef<T>(null);
  useFocusEffect(
    useCallback(() => {
      ref.current?.scrollTo?.({ y: 0, animated: false });
      ref.current?.scrollToOffset?.({ offset: 0, animated: false });
    }, []),
  );
  return ref;
}
