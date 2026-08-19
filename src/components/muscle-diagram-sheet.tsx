import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { MuscleChipRow } from '@/components/muscle-chip-row';
import { MuscleDiagram } from '@/components/muscle-diagram';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

const colors = Colors;

/**
 * "View muscle groups" popup — a larger dual-view diagram plus the labeled
 * chip list. The only reusable bottom-sheet in the app; token values copied
 * from settings.tsx's hand-rolled modal since no shared Modal component
 * exists yet.
 */
export function MuscleDiagramSheet({
  visible,
  primary,
  secondary,
  onClose,
}: {
  visible: boolean;
  primary: string[];
  secondary: string[];
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <ThemedText type="smallBold">Muscle Groups</ThemedText>
        <View style={styles.diagramWrap}>
          <MuscleDiagram primary={primary} secondary={secondary} view="dual" size="large" />
        </View>
        <MuscleChipRow slugs={[...primary, ...secondary]} />
        <Pressable style={styles.doneButton} onPress={onClose}>
          <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
            Done
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  diagramWrap: {
    alignItems: 'center',
  },
  doneButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
});
