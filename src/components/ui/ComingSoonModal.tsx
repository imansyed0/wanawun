import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { BorderRadius, Colors, FontFamily, FontSize, LineHeight, Spacing } from '@/src/constants/theme';
import { submitFeatureFeedback, type FeatureKey } from '@/src/services/featureInterestService';

const MAX_FEEDBACK_LENGTH = 2000;

interface ComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
  featureKey: FeatureKey;
  title: string;
  description: string;
  placeholder?: string;
}

/**
 * Fake-door popout: tells the user a feature is still being built and asks how
 * they'd like it to work. Feedback lands in the feature_interest table.
 */
export function ComingSoonModal({
  visible,
  onClose,
  featureKey,
  title,
  description,
  placeholder = 'Share any ideas you have…',
}: ComingSoonModalProps) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start fresh each time the popout opens.
  useEffect(() => {
    if (visible) {
      setFeedback('');
      setSubmitting(false);
      setSubmitted(false);
      setError(null);
    }
  }, [visible]);

  const canSubmit = feedback.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeatureFeedback(featureKey, feedback);
      setSubmitted(true);
    } catch (e) {
      console.warn(`Failed to submit feedback for ${featureKey}`, e);
      setError("Couldn't send that just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.wrap}>
          <Card style={styles.card}>
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>IN BUILD</Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={handleClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeButtonText}>{'×'}</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{description}</Text>

            {submitted ? (
              <>
                <Text style={styles.thanks}>
                  Thank you! Your ideas will help shape what we build.
                </Text>
                <Button title="Done" onPress={onClose} />
              </>
            ) : (
              <>
                <Text style={styles.label}>Your ideas</Text>
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textLight}
                  value={feedback}
                  onChangeText={setFeedback}
                  maxLength={MAX_FEEDBACK_LENGTH}
                  multiline
                  textAlignVertical="top"
                  editable={!submitting}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button
                  title={submitting ? 'Sending…' : 'Send feedback'}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                />
                <Button title="Maybe later" variant="ghost" size="sm" onPress={handleClose} />
              </>
            )}
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  label: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemi,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  input: {
    minHeight: 110,
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
