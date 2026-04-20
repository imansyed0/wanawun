import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AudioRecorder } from 'expo-audio';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '@/src/components/ui/Card';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { addGlossaryWord, deleteGlossaryWord, getGlossaryWords, invalidateWordCache } from '@/src/services/wordService';
import { playAudio, stopAudio, startRecording, stopAndUploadRecording, linkAudioToWord } from '@/src/services/audioService';
import { useAuth } from '@/src/hooks/useAuth';
import type { WordEntry } from '@/src/types';

export default function LearnScreen() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [newKashmiri, setNewKashmiri] = useState('');
  const [newEnglish, setNewEnglish] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Audio state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const recordingRef = useRef<AudioRecorder | null>(null);

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGlossaryWords(user?.id);
      setWords(data);
    } catch {
      // Keep the existing list if the refresh fails.
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadWords();
    }, [loadWords])
  );

  const filtered = words.filter(
    (w) =>
      w.kashmiri.toLowerCase().includes(search.toLowerCase()) ||
      w.english.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddWord = useCallback(async () => {
    if (!user?.id) {
      setAddError('Sign in to add vocabulary.');
      return;
    }

    const trimmedKashmiri = newKashmiri.trim();
    const trimmedEnglish = newEnglish.trim();

    if (!trimmedKashmiri || !trimmedEnglish) {
      setAddError('Enter both Kashmiri and English before adding a word.');
      return;
    }

    setAdding(true);
    setAddError('');

    try {
      const newWord = await addGlossaryWord(user.id, trimmedKashmiri, trimmedEnglish);
      setWords((prev) => {
        const withoutDuplicate = prev.filter(
          (entry) =>
            !(
              entry.kashmiri.trim().toLowerCase() === newWord.kashmiri.trim().toLowerCase() &&
              entry.english.trim().toLowerCase() === newWord.english.trim().toLowerCase()
            )
        );

        return [...withoutDuplicate, newWord].sort((a, b) =>
          a.kashmiri.localeCompare(b.kashmiri)
        );
      });
      invalidateWordCache();
      setNewKashmiri('');
      setNewEnglish('');
      setIsAddModalOpen(false);
    } catch (error: any) {
      console.error('Glossary add error:', error);
      setAddError(error?.message || 'Could not add this word right now.');
    } finally {
      setAdding(false);
    }
  }, [newEnglish, newKashmiri, user?.id]);

  const openAddModal = useCallback(() => {
    setAddError('');
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    if (adding) return;
    setIsAddModalOpen(false);
    setAddError('');
    setNewKashmiri('');
    setNewEnglish('');
  }, [adding]);

  const handlePlay = useCallback(async (word: WordEntry) => {
    if (!word.audio_url) return;
    if (playingId === word.id) {
      await stopAudio();
      setPlayingId(null);
      return;
    }
    setPlayingId(word.id);
    try {
      await playAudio(word.audio_url, {
        onFinish: () => setPlayingId(null),
      });
    } catch (e) {
      console.error('Playback error:', e);
      setPlayingId(null);
    }
  }, [playingId]);

  const handleRecord = useCallback(async (word: WordEntry) => {
    if (!user?.id) return;

    // If already recording this word, stop and save
    if (recordingId === word.id && recordingRef.current) {
      setSavingId(word.id);
      try {
        const url = await stopAndUploadRecording(recordingRef.current, user.id, word.id);
        // Update local state
        setWords((prev) =>
          prev.map((w) => (w.id === word.id ? { ...w, audio_url: url } : w))
        );
        try {
          await linkAudioToWord(word.id, url);
          invalidateWordCache();
        } catch (linkError) {
          console.error('Recording link error:', linkError);
        }
      } catch (e: any) {
        console.error('Recording save error:', e);
      } finally {
        recordingRef.current = null;
        setRecordingId(null);
        setSavingId(null);
      }
      return;
    }

    // Start recording
    try {
      // Stop any existing recording first
      if (recordingRef.current) {
        await recordingRef.current.stop();
        recordingRef.current = null;
      }
      const recording = await startRecording();
      recordingRef.current = recording;
      setRecordingId(word.id);
    } catch (e: any) {
      console.error('Recording start error:', e);
      setRecordingId(null);
    }
  }, [recordingId, user?.id]);

  const handleDelete = useCallback(async (word: WordEntry) => {
    if (!user?.id) return;

    setDeletingId(word.id);
    try {
      await deleteGlossaryWord(user.id, word);
      invalidateWordCache();
      setWords((prev) => prev.filter((entry) => entry.id !== word.id));
    } catch (error) {
      console.error('Glossary delete error:', error);
    } finally {
      setDeletingId(null);
    }
  }, [user?.id]);

  const renderItem = useCallback(({ item }: { item: WordEntry }) => {
    const isPlaying = playingId === item.id;
    const isRecording = recordingId === item.id;
    const isSaving = savingId === item.id;
    const isDeleting = deletingId === item.id;
    const hasAudio = !!item.audio_url;

    return (
      <Card style={styles.wordCard}>
        <View style={styles.wordRow}>
          <View style={styles.wordMain}>
            <Text style={styles.kashmiri}>{item.kashmiri}</Text>
            <Text style={styles.english}>{item.english}</Text>
          </View>
          <View style={styles.audioActions}>
            {/* Play button — shown if word has audio */}
            {hasAudio && (
              <Pressable
                style={[styles.audioBtn, isPlaying && styles.audioBtnActive]}
                onPress={() => handlePlay(item)}
              >
                <Text style={[styles.audioBtnIcon, isPlaying && styles.audioBtnIconActive]}>
                  {isPlaying ? '\u23F9' : '\u25B6'}
                </Text>
              </Pressable>
            )}
            {/* Record button */}
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Pressable
                style={[
                  styles.audioBtn,
                  styles.recordBtn,
                  isRecording && styles.recordBtnActive,
                ]}
                onPress={() => handleRecord(item)}
              >
                <Text
                  style={[
                    styles.audioBtnIcon,
                    styles.recordBtnIcon,
                    isRecording && styles.recordBtnIconActive,
                  ]}
                >
                  {isRecording ? '\u23F9' : '\u23FA'}
                </Text>
              </Pressable>
            )}
            {isDeleting ? (
              <ActivityIndicator size="small" color={Colors.wrong} />
            ) : (
              <Pressable
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteBtnText}>{'\u00D7'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Card>
    );
  }, [playingId, recordingId, savingId, deletingId, handlePlay, handleRecord, handleDelete]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Glossary</Text>
        <Text style={styles.subtitle}>{words.length} Kashmiri words</Text>
      </View>

      <ScreenHeaderDecoration variant="teal" />

      <TextInput
        style={styles.searchInput}
        placeholder="Search Kashmiri or English..."
        placeholderTextColor={Colors.textLight}
        value={search}
        onChangeText={setSearch}
      />

      {recordingId && (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording... Tap stop to save</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading
              ? 'Loading glossary...'
              : 'Your glossary is empty. Start working through lessons and adding vocabulary to build it up.'}
          </Text>
        }
      />

      <Pressable style={styles.fab} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeAddModal} />
          <View style={styles.modalWrap}>
            <Card style={styles.addCard}>
              <View style={styles.addHeader}>
                <Text style={styles.addTitle}>Add To Glossary</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={closeAddModal}
                  disabled={adding}
                >
                  <Text style={styles.closeButtonText}>{'\u00D7'}</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.addInput}
                placeholder="Kashmiri"
                placeholderTextColor={Colors.textLight}
                value={newKashmiri}
                onChangeText={setNewKashmiri}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.addInput}
                placeholder="English"
                placeholderTextColor={Colors.textLight}
                value={newEnglish}
                onChangeText={setNewEnglish}
                autoCapitalize="none"
              />
              <Pressable
                style={[
                  styles.addButton,
                  (!newKashmiri.trim() || !newEnglish.trim() || adding || !user?.id) &&
                    styles.addButtonDisabled,
                ]}
                onPress={handleAddWord}
                disabled={!newKashmiri.trim() || !newEnglish.trim() || adding || !user?.id}
              >
                <Text style={styles.addButtonText}>{adding ? 'Adding...' : 'Add'}</Text>
              </Pressable>
              {addError ? <Text style={styles.addError}>{addError}</Text> : null}
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.headingBold,
    color: Colors.primaryDark,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  searchInput: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 32,
    fontFamily: FontFamily.bodySemi,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 20, 24, 0.45)',
  },
  modalWrap: {
    paddingHorizontal: Spacing.lg,
  },
  addCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  addTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
  },
  addInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSize.md,
    color: Colors.text,
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
  addError: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
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
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.wrong,
  },
  recordingText: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
    fontFamily: FontFamily.bodySemi,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: 120,
  },
  wordCard: {
    padding: Spacing.md,
  },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordMain: {
    flex: 1,
  },
  kashmiri: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.heading,
    color: Colors.accent,
  },
  english: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  audioActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  audioBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBtnActive: {
    backgroundColor: Colors.primary,
  },
  audioBtnIcon: {
    fontSize: 14,
    color: Colors.primary,
  },
  audioBtnIconActive: {
    color: '#fff',
  },
  recordBtn: {
    backgroundColor: '#fef2f2',
  },
  recordBtnActive: {
    backgroundColor: Colors.wrong,
  },
  recordBtnIcon: {
    color: Colors.wrong,
  },
  recordBtnIconActive: {
    color: '#fff',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: Colors.wrong,
    fontSize: 18,
    fontFamily: FontFamily.bodyBold,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.xl,
  },
});
