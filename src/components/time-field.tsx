import DateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { timeOnDate } from '@/lib/store/derive';

/**
 * A labelled iOS compact time picker. The picked clock time is always
 * re-anchored onto `date`, so scrolling past midnight in the wheel never
 * silently moves an entry to another day.
 */
export function TimeField({
  label = 'TIME',
  date,
  value,
  onChange,
}: {
  label?: string;
  /** Date key the time belongs to. */
  date: string;
  /** ISO timestamp. */
  value: string;
  onChange: (iso: string) => void;
}) {
  return (
    <View style={styles.row}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <DateTimePicker
        value={new Date(value)}
        mode="time"
        display="compact"
        themeVariant="dark"
        accentColor={Colors.primaryLight}
        minuteInterval={5}
        onValueChange={(_event, selected) => {
          onChange(timeOnDate(date, selected.getHours(), selected.getMinutes()));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
