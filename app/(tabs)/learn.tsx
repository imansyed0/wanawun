import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AudioRecorder } from 'expo-audio';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '@/src/components/ui/Card';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, LineHeight, Spacing, BorderRadius } from '@/src/constants/theme';
import { deleteGlossaryWord, getGlossaryWords, invalidateWordCache } from '@/src/services/wordService';
import { isPendingWordId, removePendingGlossaryWord } from '@/src/services/pendingGlossaryService';
import { useQuickAddStore } from '@/src/stores/quickAddStore';
import { playAudio, stopAudio, startRecording, stopAndUploadRecording, linkAudioToWord } from '@/src/services/audioService';
import { useAuth } from '@/src/hooks/useAuth';
import type { WordEntry } from '@/src/types';

export default function LearnScreen() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // Words added through the app-wide quick-add sheet (the floating +).
  const lastAdded = useQuickAddStore((s) => s.lastAdded);

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

  useEffect(() => {
    if (!lastAdded) return;
    const newWord = lastAdded;
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
  }, [lastAdded]);

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
    if (!user?.id && !isPendingWordId(word.id)) return;

    setDeletingId(word.id);
    try {
      if (isPendingWordId(word.id)) {
        await removePendingGlossaryWord(word.id);
      } else if (user?.id) {
        await deleteGlossaryWord(user.id, word);
      }
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
      <View style={{ flex: 1 }}>
        {/* Tap on the non-scrollable header area dismisses the keyboard.
            We deliberately do NOT wrap the FlatList in TouchableWithoutFeedback
            because that swallows the list's pan gesture on iOS and breaks
            scrolling. The FlatList uses keyboardDismissMode="on-drag" so
            scrolling the list also dismisses the keyboard. */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View>
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
          </View>
        </TouchableWithoutFeedback>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {loading
                ? 'Loading glossary...'
                : 'Your glossary is empty. Start working through lessons and adding vocabulary to build it up.'}
            </Text>
          }
        />
        {/* The + to add a word is the app-wide QuickAddFab (root layout). */}
      </View>
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
    // Tall enough that Kashmiri diacritics typed into the field aren't clipped.
    minHeight: 52,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSize.md,
    color: Colors.text,
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
    lineHeight: LineHeight.kashmiri(FontSize.lg),
    fontFamily: FontFamily.kashmiri,
    color: Colors.accent,
  },
  english: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
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
