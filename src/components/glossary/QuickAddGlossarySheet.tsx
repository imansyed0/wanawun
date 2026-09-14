import { useCallback, useState } from 'react';
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
import { router } from 'expo-router';
import { Card } from '@/src/components/ui/Card';
import { Grandmother } from '@/src/components/onboarding/Grandmother';
import { getBubble } from '@/src/components/tutorial/tutorialCopy';
import { BorderRadius, Colors, FontFamily, FontSize, LineHeight, Spacing } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { addGlossaryWord, invalidateWordCache } from '@/src/services/wordService';
import { stashPendingGlossaryWord } from '@/src/services/pendingGlossaryService';
import { useQuickAddStore } from '@/src/stores/quickAddStore';
import { useTutorialStore } from '@/src/stores/tutorialStore';

/**
 * The "Add To Glossary" sheet, shared by the whole app and opened by the
 * floating + button. Signed-in users write straight to Supabase; signed-out
 * users get a local glossary that syncs into their account on sign-in.
 */
export function QuickAddGlossarySheet() {
  const isOpen = useQuickAddStore((s) => s.isOpen);
  const { user, loading: authLoading } = useAuth();
  const [kashmiri, setKashmiri] = useState('');
  const [english, setEnglish] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const tutorialActive = useTutorialStore((s) => s.active);
  const tutorialStep = useTutorialStore((s) => s.step);
  const tutorialBubble =
    tutorialActive && isOpen && tutorialStep === 'add-word'
      ? getBubble('add-word', true, false, null, false)
      : null;

  const reset = () => {
    setKashmiri('');
    setEnglish('');
    setError('');
  };

  const close = useCallback(() => {
    if (adding) return;
    useQuickAddStore.getState().close();
    reset();
    useTutorialStore.getState().notify('addModalClosed');
  }, [adding]);

  const handleAdd = useCallback(async () => {
    const trimmedKashmiri = kashmiri.trim();
    const trimmedEnglish = english.trim();
    if (!trimmedKashmiri || !trimmedEnglish) {
      setError('Enter both Kashmiri and English before adding a word.');
      return;
    }

    setAdding(true);
    setError('');
    try {
      // Signed-out words live locally and sync into the account on sign-in.
      const newWord = user?.id
        ? await addGlossaryWord(user.id, trimmedKashmiri, trimmedEnglish)
        : await stashPendingGlossaryWord({ kashmiri: trimmedKashmiri, english: trimmedEnglish });
      invalidateWordCache();
      reset();
      useQuickAddStore.getState().wordAdded(newWord);
      useTutorialStore.getState().notify('wordAdded');
    } catch (e: any) {
      console.error('Glossary add error:', e);
      setError(e?.message || 'Could not add this word right now.');
    } finally {
      setAdding(false);
    }
  }, [english, kashmiri, user?.id]);

  const goToSignIn = () => {
    close();
    router.push('/auth/login');
  };

  const canSubmit = !!kashmiri.trim() && !!english.trim() && !adding;
  const showSignedOutNote = !authLoading && !user;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.wrap}>
          {tutorialBubble ? (
            <View style={styles.tutorialHintRow} pointerEvents="none">
              <Grandmother pose={tutorialBubble.pose} size={56} />
              <View style={styles.tutorialHintBubble}>
                <Text style={styles.tutorialHintText}>{tutorialBubble.text}</Text>
              </View>
            </View>
          ) : null}
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Add To Glossary</Text>
              <Pressable
                style={styles.closeButton}
                onPress={close}
                disabled={adding}
                accessibilityLabel="Close"
              >
                <Text style={styles.closeButtonText}>{'×'}</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, styles.inputKashmiri]}
              placeholder="Kashmiri"
              placeholderTextColor={Colors.textLight}
              value={kashmiri}
              onChangeText={setKashmiri}
              autoCapitalize="none"
              autoFocus
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="English"
              placeholderTextColor={Colors.textLight}
              value={english}
              onChangeText={setEnglish}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSubmit) handleAdd();
              }}
            />
            <Pressable
              style={[styles.addButton, !canSubmit && styles.addButtonDisabled]}
              onPress={handleAdd}
              disabled={!canSubmit}
            >
              <Text style={styles.addButtonText}>{adding ? 'Adding...' : 'Add'}</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {showSignedOutNote ? (
              <Text style={styles.signedOutNote}>
                You’re not signed in — this word is saved on this device and syncs to your
                account when you{' '}
                <Text style={styles.signedOutLink} onPress={goToSignIn}>
                  sign in
                </Text>
                .
              </Text>
            ) : null}
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
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  tutorialHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tutorialHintBubble: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  tutorialHintText: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body(FontSize.sm),
    color: Colors.text,
    fontFamily: FontFamily.bodySemi,
  },
  card: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 48,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  inputKashmiri: {
    // Kashmiri is set in Amiri, so the field needs a generous line box
    // or the vowel diacritics get clipped.
    fontFamily: FontFamily.kashmiriRegular,
    fontSize: FontSize.lg,
    minHeight: 56,
  },
  addButton: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  addButtonDisabled: {
    opacity: 0.45,
  },
  addButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodyBold,
  },
  error: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
  },
  signedOutNote: {
    fontSize: FontSize.xs,
    lineHeight: LineHeight.body(FontSize.xs),
    color: Colors.textSecondary,
  },
  signedOutLink: {
    color: Colors.primaryDark,
    fontFamily: FontFamily.bodyBold,
    textDecorationLine: 'underline',
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
});
