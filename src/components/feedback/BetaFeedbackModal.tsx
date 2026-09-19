import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  LineHeight,
  Spacing,
} from '@/src/constants/theme';
import { MAX_BETA_FEEDBACK_LENGTH, submitBetaFeedback } from '@/src/services/betaFeedbackService';

interface BetaFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Beta feedback popout. Two shapes, because the two betas have different
 * channels: iOS testers are on TestFlight, which turns any screenshot into a
 * message to us, so this only explains that. Play internal testing has no
 * equivalent, so Android (and web) type into a box we write to Supabase
 * ourselves — and are never told to screenshot, because nothing would catch it.
 *
 * TEMPORARY (beta only): delete this file when the beta ends.
 */
export function BetaFeedbackModal({ visible, onClose }: BetaFeedbackModalProps) {
  return Platform.OS === 'ios' ? (
    <TestFlightExplainer visible={visible} onClose={onClose} />
  ) : (
    <FeedbackForm visible={visible} onClose={onClose} />
  );
}

function TestFlightExplainer({ visible, onClose }: BetaFeedbackModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Inside the scroll content: a ScrollView swallows touches, so a
            backdrop behind it would stop closing the modal. */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.wrap}>
          <Card style={styles.card}>
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>BETA</Text>
              </View>
              <CloseButton onPress={onClose} />
            </View>

            <Text style={styles.title}>Screenshot to tell us anything</Text>
            <Text style={styles.body}>
              While you&rsquo;re on the TestFlight beta, take a screenshot
              anywhere in the app. TestFlight will ask if you want to send it to
              us. Add a note and send it.
            </Text>
            <Text style={styles.body}>
              Tell us what you liked, what confused you, something you wish the
              app did, or a question. All of it is welcome. The picture goes
              with it, so it is the easiest way to show us something instead of
              describing it.
            </Text>

            <Button title="Got it" onPress={onClose} />
          </Card>
        </View>
      </ScrollView>
    </Modal>
  );
}

function FeedbackForm({ visible, onClose }: BetaFeedbackModalProps) {
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start fresh each time the popout opens.
  useEffect(() => {
    if (visible) {
      setFeedback('');
      setSending(false);
      setSent(false);
      setError(null);
    }
  }, [visible]);

  const canSend = feedback.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await submitBetaFeedback(feedback);
      setSent(true);
    } catch (e) {
      // The text stays in state, so tapping send again resends it as typed.
      console.warn('Failed to send beta feedback', e);
      setError("That didn't send. Your words are still here, so try again.");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    if (sending) return;
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* Android is edge-to-edge, so the window never resizes for the keyboard
          and a Modal gets no inset of its own; the centred card needs the same
          padding on iOS. Same handling as the coming-soon popout. */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* See the backdrop note above. */}
          <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close" />
          <View style={styles.wrap}>
            <Card style={styles.card}>
              <View style={styles.header}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>BETA</Text>
                </View>
                <CloseButton onPress={handleClose} disabled={sending} />
              </View>

              <Text style={styles.title}>Tell us anything</Text>

              {sent ? (
                <>
                  <Text style={styles.thanks}>Thank you. We&rsquo;ve got it.</Text>
                  <Button title="Done" onPress={onClose} />
                </>
              ) : (
                <>
                  <Text style={styles.body}>
                    What you liked, what confused you, something you wish the
                    app did, or a question. Anything at all. A line or two is
                    plenty.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="What’s on your mind?"
                    placeholderTextColor={Colors.textLight}
                    value={feedback}
                    onChangeText={setFeedback}
                    maxLength={MAX_BETA_FEEDBACK_LENGTH}
                    multiline
                    textAlignVertical="top"
                    editable={!sending}
                    accessibilityLabel="Your feedback"
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Button
                    title={sending ? 'Sending…' : 'Send'}
                    onPress={handleSend}
                    disabled={!canSend}
                  />
                  <Button title="Not now" variant="ghost" size="sm" onPress={handleClose} />
                </>
              )}
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CloseButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={styles.closeButton}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Text style={styles.closeButtonText}>{'×'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  },
  card: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: '#fff',
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: Colors.textSecondary,
    fontSize: 22,
    lineHeight: 24,
  },
  title: {
    fontSize: FontSize.xl,
    lineHeight: LineHeight.heading(FontSize.xl),
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
    marginTop: Spacing.xs,
  },
  body: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.textSecondary,
  },
  input: {
    minHeight: 110,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  error: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
  },
  thanks: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    fontFamily: FontFamily.bodySemi,
    color: Colors.primaryDark,
    marginVertical: Spacing.sm,
  },
});
