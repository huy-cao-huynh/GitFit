import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimeField } from '@/components/time-field';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { addMacros, EMPTY_MACROS, macroSummary, suggestMealTitle } from '@/lib/store/derive';
import { isLegacyEventId } from '@/lib/store/id';
import type { FoodLogEntry, Macros } from '@/lib/store/types';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

/**
 * One meal event on the Food timeline: move it (time), name it (title), open
 * or remove its foods, add more via the search basket, or delete the lot.
 * Food rows push the existing `food/[id]` amount editor.
 */
export default function MealEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mealEvents, foodLogs, updateMealEvent, deleteMealEvent, deleteFoodLog } = useStore();
  const event = mealEvents.find((candidate) => candidate.id === id);
  // foodLogs is newest-first; show foods in the order they were logged.
  const items = foodLogs.filter((entry) => entry.eventId === id).reverse();

  const [loggedAt, setLoggedAt] = useState(event?.loggedAt ?? new Date().toISOString());
  const [title, setTitle] = useState(event?.title ?? '');

  if (!event) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topRow}>
            <Pressable hitSlop={12} onPress={() => router.back()}>
              <ThemedText type="link" themeColor="textSecondary">
                Close
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            This meal no longer exists.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Pre-0013 events are synthesized from old meal categories and have no row
  // to move or append to; they can still be browsed and deleted.
  const legacy = isLegacyEventId(event.id);
  const totals = items.reduce<Macros>((sum, item) => addMacros(sum, item), EMPTY_MACROS);

  const done = () => {
    const trimmed = title.trim();
    const nextTitle = trimmed.length > 0 ? trimmed : undefined;
    if (!legacy && (loggedAt !== event.loggedAt || nextTitle !== event.title)) {
      haptics.impact();
      updateMealEvent({ ...event, loggedAt, title: nextTitle });
    }
    router.back();
  };

  const confirmDeleteItem = (item: FoodLogEntry) => {
    const isLast = items.length === 1;
    Alert.alert(
      'Remove food?',
      isLast ? `${item.name} is the only food here, so the meal goes too.` : `Removes ${item.name} from this meal.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            haptics.notification(Haptics.NotificationFeedbackType.Warning);
            deleteFoodLog(item.id);
            if (isLast) router.back();
          },
        },
      ],
    );
  };

  const confirmDeleteEvent = () => {
    Alert.alert('Delete meal?', `Removes all ${items.length} food${items.length === 1 ? '' : 's'} in it for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.notification(Haptics.NotificationFeedbackType.Warning);
          deleteMealEvent(event.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <View style={styles.topSpacer} />
          <ThemedText type="smallBold" numberOfLines={1} style={styles.topTitle}>
            {title.trim() || suggestMealTitle(loggedAt)}
          </ThemedText>
          <Pressable hitSlop={12} onPress={done} style={styles.topSpacer}>
            <ThemedText type="linkPrimary" style={styles.doneLabel}>
              Done
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {legacy ? (
            <ThemedText type="small" themeColor="textSecondary">
              Logged before meal times existed. Apply migration 0013 to move it, rename it, or add foods.
            </ThemedText>
          ) : (
            <View style={styles.card}>
              <TimeField date={event.date} value={loggedAt} onChange={setLoggedAt} />
              <TextInput
                style={styles.titleInput}
                placeholder={`${suggestMealTitle(loggedAt)} (title optional)`}
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                returnKeyType="done"
              />
            </View>
          )}

          <View style={styles.totalsRow}>
            <ThemedText type="label">FOODS</ThemedText>
            <ThemedText type="small">
              <ThemedText type="statInline">{Math.round(totals.calories)}</ThemedText> cal ·{' '}
              {macroSummary(totals)}
            </ThemedText>
          </View>

          <View style={styles.card}>
            {items.map((item, index) => (
              <Pressable
                key={item.id}
                style={[styles.foodRow, index > 0 && styles.rowDivider]}
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: item.id } })}>
                <View style={styles.foodText}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
                    {[item.brand, item.grams !== undefined ? `${Math.round(item.grams)} g` : undefined, macroSummary(item)]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </View>
                <ThemedText type="small">
                  <ThemedText type="statInline">{Math.round(item.calories)}</ThemedText> cal
                </ThemedText>
                <Pressable hitSlop={8} onPress={() => confirmDeleteItem(item)}>
                  <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
            {!legacy && (
              <Pressable
                style={[styles.addRow, items.length > 0 && styles.rowDivider]}
                onPress={() => router.push({ pathname: '/food/search', params: { eventId: event.id } })}>
                <SymbolView name="plus.circle.fill" size={20} tintColor={colors.primaryLight} />
                <ThemedText type="small" style={styles.addLabel}>
                  Add food
                </ThemedText>
              </Pressable>
            )}
          </View>

          <Pressable style={styles.deleteButton} onPress={confirmDeleteEvent}>
            <ThemedText type="smallBold" themeColor="danger">
              Delete meal
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  topSpacer: {
    width: 56,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
  },
  doneLabel: {
    textAlign: 'right',
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  titleInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
    color: colors.text,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  foodText: {
    flex: 1,
    gap: Spacing.half,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  addLabel: {
    color: colors.primaryLight,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
