import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { WeekDay } from '@/lib/store/derive';

/**
 * The Sunday-to-Saturday dot row. A day's dot goes through multiple colors
 * depending on how much of that day's goals (planned workout + check-offs)
 * were completed: outlined (none), primaryLight (partial), solid primary with
 * a check mark (all).
 */
export function WeekStreak({ days, size = 32 }: { days: WeekDay[]; size?: number }) {
  return (
    <View style={styles.row}>
      {days.map((day) => (
        <View key={day.date} style={styles.day}>
          <View
            style={[
              styles.dot,
              { width: size, height: size, borderRadius: size / 2 },
              day.status === 'all' && { backgroundColor: Colors.primary },
              day.status === 'partial' && { backgroundColor: Colors.primaryLight },
              day.status === 'none' && {
                borderWidth: 2,
                borderColor: day.isToday ? Colors.primaryLight : Colors.border,
              },
            ]}>
            {day.status === 'all' && <SymbolView name="checkmark" size={size * 0.42} tintColor={Colors.text} />}
          </View>
          <ThemedText
            type="small"
            themeColor={day.isToday ? 'text' : 'textSecondary'}
            style={styles.label}>
            {day.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
  },
});
