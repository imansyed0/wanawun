import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';

interface WordSheetProps {
  visible: boolean;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}

/**
 * Bottom-sheet shell shared by the tap-a-word popups: the Kashmiri definition
 * sheet (WAN-13) and the English → Kashmiri sheet (WAN-53).
 */
export function WordSheet({ visible, onClose, closeLabel = 'Close', children }: WordSheetProps) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          {children}
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 42, 45, 0.35)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  closeBtn: {
    marginTop: Spacing.lg,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
  },
  closeText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemi,
    color: Colors.text,
  },
});
