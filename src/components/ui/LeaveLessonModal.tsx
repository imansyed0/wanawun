import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Grandmother } from '@/src/components/onboarding/Grandmother';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  LineHeight,
  Spacing,
} from '@/src/constants/theme';

interface LeaveLessonModalProps {
  visible: boolean;
  /** Stay in the lesson and open the add-a-word sheet. */
  onAddWord: () => void;
  /** Stay in the lesson, no sheet. Also the backdrop / hardware-back action. */
  onStay: () => void;
  /** Go anyway. */
  onLeave: () => void;
}

/**
 * Naani catches people on their way out of a lesson they listened to but never
 * added a word from. Listening alone slides off; the glossary and your own
 * voice are what make it stick, so she asks for one word before they go.
 */
export function LeaveLessonModal({
  visible,
  onAddWord,
  onStay,
  onLeave,
}: LeaveLessonModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Inside the scroll content: a ScrollView swallows touches, so a
            backdrop behind it would stop closing the modal. */}
        <Pressable
          style={styles.backdrop}
          onPress={onStay}
          accessibilityLabel="Stay in the lesson"
        />
        <View style={styles.wrap}>
          <Card style={styles.card}>
            <View style={styles.naani}>
              <Grandmother pose="point" size={110} />
            </View>

            <Text style={styles.title}>Wait, jaanu. Not one word?</Text>
            <Text style={styles.body}>
              You didn&rsquo;t add any words from this lesson.
            </Text>
            <Text style={styles.body}>
              Adding words to your glossary, going back over them, and recording
              yourself saying them is how you really learn.
            </Text>
            <View style={styles.nudge}>
              <Text style={styles.nudgeText}>Even one word counts.</Text>
            </View>

            <Button title="Alright, let me add one" onPress={onAddWord} />
            <Button title="Leave anyway" variant="ghost" size="sm" onPress={onLeave} />
          </Card>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 20, 24, 0.45)',
  },
  wrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  naani: {
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    lineHeight: LineHeight.heading(FontSize.xl),
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  nudge: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  nudgeText: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body(FontSize.sm),
    fontFamily: FontFamily.bodySemi,
    color: Colors.walnut,
    textAlign: 'center',
  },
});
