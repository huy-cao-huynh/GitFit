import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

import { Colors } from '@/constants/theme';

/** Small tappable SF-symbol action (add/save rows); dims and disables when inactive. */
export function IconButton({
  icon,
  active,
  onPress,
}: {
  icon: 'plus.circle.fill' | 'checkmark.circle.fill';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable hitSlop={8} onPress={onPress} disabled={!active}>
      <SymbolView name={icon} size={24} tintColor={active ? Colors.primaryLight : Colors.textMuted} />
    </Pressable>
  );
}
