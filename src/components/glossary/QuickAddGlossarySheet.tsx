import { useCallback, useRef, useState } from 'react';
import type { AudioRecorder } from 'expo-audio';
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
import {
  linkAudioToWord,
  playAudio,
  releaseRecording,
  startRecording,
  stopAudio,
  stopRecording,
  uploadRecording,
} from '@/src/services/audioService';
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

  // Optional pronunciation (WAN-54): recorded locally, previewed, then
  // uploaded and linked to the word once it's been added.
  const recorderRef = useRef<AudioRecorder | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  const discardRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      if (recorder.isRecording) {
        try {
          await stopRecording(recorder);
        } catch {}
      }
      releaseRecording(recorder);
    }
    await stopAudio();
    setIsPlayingRecording(false);
    setRecordingUri(null);
    setRecordingState('idle');
    setRecordingError('');
  }, []);

  const handleRecordPress = async () => {
    if (recordingState === 'recording' && recorderRef.current) {
      try {
        const uri = await stopRecording(recorderRef.current);
        setRecordingUri(uri);
        setRecordingState('recorded');
      } catch (e) {
        console.error('Quick add recording stop error:', e);
        await discardRecording();
        setRecordingError("Couldn't save that recording. Please try again.");
      }
      return;
    }

    // Recording again replaces the previous take.
    await discardRecording();
    try {
      recorderRef.current = await startRecording();
      setRecordingState('recording');
    } catch (e: any) {
      console.error('Quick add recording start error:', e);
      setRecordingError(
        /permission/i.test(e?.message ?? '')
          ? 'Allow microphone access to record how the word sounds.'
          : "Couldn't start recording. Please try again."
      );
    }
  };

  const handlePlayRecording = async () => {
    if (!recordingUri) return;
    if (isPlayingRecording) {
      await stopAudio();
      setIsPlayingRecording(false);
      return;
    }
    setIsPlayingRecording(true);
    try {
      await playAudio(recordingUri, {
        onFinish: () => setIsPlayingRecording(false),
        tag: 'quickAddPreview',
      });
    } catch (e) {
      console.error('Quick add recording playback error:', e);
      setIsPlayingRecording(false);
    }
  };

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
    void discardRecording();
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
      // Upload the pronunciation now the word exists, so it can be linked.
      let savedWord = newWord;
      let recordingFailed = false;
      if (user?.id && recordingUri && !newWord.id.startsWith('lesson-vocab:')) {
        try {
          const url = await uploadRecording(recordingUri, user.id, newWord.id);
          await linkAudioToWord(newWord.id, url);
          savedWord = { ...newWord, audio_url: url };
        } catch (e) {
          console.error('Quick add recording upload error:', e);
          recordingFailed = true;
        }
      }
      invalidateWordCache();
      reset();
      useQuickAddStore.getState().wordAdded(savedWord, recordingFailed);
      useTutorialStore.getState().notify('wordAdded');
      if (recordingFailed) {
        setError("Word added, but the recording couldn't be saved. You can record it from your glossary.");
      }
    } catch (e: any) {
      console.error('Glossary add error:', e);
      setError(e?.message || 'Could not add this word right now.');
    } finally {
      setAdding(false);
    }
  }, [english, kashmiri, recordingUri, user?.id]);

  const goToSignIn = () => {
    close();
    router.push('/auth/login');
  };

  const canSubmit =
    !!kashmiri.trim() && !!english.trim() && !adding && recordingState !== 'recording';
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
              <Text style={styles.title}>Add a word to glossary</Text>
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
              // Amiri only once there's Kashmiri typed, so the placeholder
              // matches the English field.
              style={[styles.input, kashmiri ? styles.inputKashmiri : null]}
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
            {user ? (
              recordingState === 'recorded' ? (
                <View style={styles.recordField}>
                  <View style={[styles.recordDot, styles.recordDotDone]} />
                  <Text style={styles.recordLabel}>Pronunciation recorded</Text>
                  <View style={styles.recordActions}>
                    <Pressable
                      onPress={handlePlayRecording}
                      disabled={adding}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.recordAction}>{isPlayingRecording ? 'Stop' : 'Play'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleRecordPress}
                      disabled={adding}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Record again"
                    >
                      <Text style={styles.recordAction}>Redo</Text>
                    </Pressable>
                    <Pressable
                      onPress={discardRecording}
                      disabled={adding}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Remove recording"
                    >
                      <Text style={[styles.recordAction, styles.recordActionMuted]}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.recordField,
                    recordingState === 'recording' && styles.recordFieldActive,
                  ]}
                  onPress={handleRecordPress}
                  disabled={adding}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.recordDot,
                      recordingState === 'recording' && styles.recordDotActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.recordLabel,
                      recordingState === 'idle' && styles.recordLabelIdle,
                    ]}
                  >
                    {recordingState === 'recording'
                      ? 'Recording… tap to stop'
                      : 'Record pronunciation'}
                  </Text>
                  {recordingState === 'idle' ? (
                    <Text style={styles.recordOptional}>optional</Text>
                  ) : null}
                </Pressable>
              )
            ) : null}
            {recordingError ? <Text style={styles.error}>{recordingError}</Text> : null}
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
                . Signing in also lets you record how it sounds.
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
    minHeight: 56,
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
  // The recorder reads as a third field: same height, fill, border and type
  // as the inputs above it.
  recordField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recordFieldActive: {
    borderColor: Colors.wrong,
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.wrong,
    opacity: 0.5,
  },
  recordDotActive: {
    opacity: 1,
  },
  recordDotDone: {
    backgroundColor: Colors.correct,
    opacity: 1,
  },
  recordLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  recordLabelIdle: {
    color: Colors.textLight,
  },
  recordOptional: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textLight,
  },
  recordActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  recordAction: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemi,
    color: Colors.primaryDark,
  },
  recordActionMuted: {
    color: Colors.textSecondary,
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
