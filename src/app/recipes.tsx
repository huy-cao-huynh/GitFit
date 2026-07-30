import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { recipePerServing } from '@/lib/store/derive';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

/** The personal recipe book: browse, create, and open recipes for editing. */
export default function RecipesScreen() {
  const { recipes } = useStore();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <ThemedText type="link" themeColor="textSecondary">
              Close
            </ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Recipe Book</ThemedText>
          <View style={styles.topSpacer} />
        </View>

        <FlatList
          data={recipes}
          keyExtractor={(recipe) => recipe.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable style={styles.createRow} onPress={() => router.push('/recipe/new')}>
              <View style={styles.createIcon}>
                <SymbolView name="plus" size={16} tintColor={colors.onPrimary} />
              </View>
              <ThemedText type="smallBold" style={{ color: colors.primaryLight }}>
                New Recipe
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item }) => {
            const perServing = recipePerServing(item);
            return (
              <Pressable
                style={styles.recipeRow}
                onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}>
                <View style={styles.recipeText}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.ingredients.length} ingredients · {Math.round(perServing.calories)} cal /
                    serving · {item.servings} servings
                  </ThemedText>
                </View>
                <Chevron color={colors.textSecondary} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              Build recipes once, then log a serving in one tap from Add Food.
            </ThemedText>
          }
        />
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
    paddingVertical: Spacing.three,
  },
  topSpacer: {
    width: 44,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  createRow: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
    padding: Spacing.three,
  },
  recipeText: {
    flex: 1,
    gap: Spacing.half,
  },
});
