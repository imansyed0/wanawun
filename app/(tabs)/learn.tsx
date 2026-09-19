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
import { deleteGlossaryWord, invalidateWordCache } from '@/src/services/wordService';
import { isPendingWordId, removePendingGlossaryWord } from '@/src/services/pendingGlossaryService';
// Starter words for the level the learner picked when Naani asked.
import { getGlossaryWordsWithStarters } from '@/src/services/starterGlossaryService';
import { useQuickAddStore } from '@/src/stores/quickAddStore';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTutorialStore } from '@/src/stores/tutorialStore';
import { playAudio, stopAudio, startRecording, stopAndUploadRecording, linkAudioToWord } from '@/src/services/audioService';
import { PlayButton, RecordButton, RecordingTimer } from '@/src/components/ui/RecordControls';
import { WordActionsSheet } from '@/src/components/glossary/WordActionsSheet';
import { useAuth } from '@/src/hooks/useAuth';
import type { WordEntry } from '@/src/types';

/**
 * Saffron ring around one word card, for the tour step where Naani explains
 * that tapping a word opens its choices. Same pulse as the ring she puts on the
 * + button, so "this is the thing to tap" looks the same wherever she says it.
 */
function RowHighlight() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 1]),
  }));

  return <Animated.View pointerEvents="none" style={[styles.rowHighlight, ring]} />;
}

/** How the glossary is ordered. 'added' is the order the words came in. */
type SortKey = 'added' | 'newest' | 'kashmiri' | 'english';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'added', label: 'Added' },
  { key: 'newest', label: 'Newest' },
  { key: 'kashmiri', label: 'A\u2013Z Koshur' },
  { key: 'english', label: 'A\u2013Z English' },
];

/** Sorts a copy of the glossary; the list itself stays in the order it loaded. */
function sortWords(words: WordEntry[], sort: SortKey): WordEntry[] {
  if (sort === 'added') return words;
  if (sort === 'newest') return [...words].reverse();
  const field = sort === 'kashmiri' ? 'kashmiri' : 'english';
  return [...words].sort((a, b) =>
    a[field].localeCompare(b[field], undefined, { sensitivity: 'base' })
  );
}

export default function LearnScreen() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('added');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // The one tour step that tells them a word row can be tapped.
  const tourPointingAtWords = useTutorialStore(
    (s) => s.active && s.step === 'word-options'
  );

  // Words added through the app-wide quick-add sheet (the floating +).
  const lastAdded = useQuickAddStore((s) => s.lastAdded);

  // Audio state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const recordingRef = useRef<AudioRecorder | null>(null);
  // The word whose options sheet is open. Held by id so the sheet always reads
  // the live entry — a fresh recording has to show up as "record again".
  const [actionsWordId, setActionsWordId] = useState<string | null>(null);

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      // Brand-new learners get a few personalised starter words, once.
      const data = await getGlossaryWordsWithStarters(user?.id);
      setWords(data);
      // So Naani's tour only takes credit for the starter words if they landed.
      useTutorialStore.getState().setGlossaryCount(data.length);
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

  // Clear the search (and dismiss the keyboard) whenever the user leaves the tab.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSearch('');
        Keyboard.dismiss();
      };
    }, [])
  );

  const filtered = sortWords(
    words.filter(
      (w) =>
        w.kashmiri.toLowerCase().includes(search.toLowerCase()) ||
        w.english.toLowerCase().includes(search.toLowerCase())
    ),
    sort
  );

  const actionsWord = words.find((w) => w.id === actionsWordId) ?? null;

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

      // Onto the end: the glossary reads in the order words were added.
      return [...withoutDuplicate, newWord];
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
      setActionsWordId(null);
    } catch (error) {
      console.error('Glossary delete error:', error);
    } finally {
      setDeletingId(null);
    }
  }, [user?.id]);

  const renderItem = useCallback(({ item, index }: { item: WordEntry; index: number }) => {
    const isPlaying = playingId === item.id;
    const isRecording = recordingId === item.id;
    const isSaving = savingId === item.id;
    const hasAudio = !!item.audio_url;
    // Recordings upload to the user's storage, so only signed-in users can record.
    const canRecord = !!user?.id;
    // Pending words only live on this device, so they can go without an account.
    const canDelete = !!user?.id || isPendingWordId(item.id);
    // A signed-out learner looking at a synced word has nothing behind the tap.
    const hasOptions = canDelete || (hasAudio && canRecord);

    // Naani points at the first row only: one ring says "rows are tappable"
    // just as well as fifty, and fifty would be a disco.
    const highlighted = tourPointingAtWords && index === 0;

    return (
      <Card style={styles.wordCard}>
        {highlighted ? <RowHighlight /> : null}
        <View style={styles.wordRow}>
          {/* The words themselves are the tap target, not the whole row: the
              play and record buttons are their own controls, and nesting them
              inside a pressable row renders a button inside a button on web. */}
          <Pressable
            style={({ pressed }) => [styles.wordMain, pressed && styles.wordRowPressed]}
            onPress={() => setActionsWordId(item.id)}
            // Mid-record and mid-save, the row's own controls are the only thing to touch.
            disabled={!hasOptions || isRecording || isSaving}
            accessibilityRole="button"
            accessibilityLabel={`${item.kashmiri}, ${item.english}`}
            accessibilityHint={hasOptions ? 'Opens options for this word' : undefined}
          >
            <Text style={styles.kashmiri} numberOfLines={2}>{item.kashmiri}</Text>
            <Text style={styles.english} numberOfLines={2}>{item.english}</Text>
          </Pressable>
          <View style={styles.audioActions}>
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : isRecording ? (
                // While recording: elapsed time + stop square, nothing else.
                <>
                  <RecordingTimer active />
                  <RecordButton recording onPress={() => handleRecord(item)} />
                </>
              ) : hasAudio ? (
                // Play is the whole inline row once a recording exists; re-record is in the sheet.
                <PlayButton playing={isPlaying} onPress={() => handlePlay(item)} />
              ) : canRecord ? (
                // The first recording stays a one-tap affordance.
                <RecordButton recording={false} onPress={() => handleRecord(item)} />
              ) : null}
            </View>
        </View>
      </Card>
    );
  }, [playingId, recordingId, savingId, handlePlay, handleRecord, user?.id, tourPointingAtWords]);

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
            </View>

            <ScreenHeaderDecoration variant="teal" />

            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search Kashmiri or English..."
                placeholderTextColor={Colors.textLight}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 ? (
                <Pressable
                  style={styles.searchClear}
                  onPress={() => setSearch('')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Text style={styles.searchClearText}>{'✕'}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.sortRow} accessibilityRole="radiogroup">
              <Text style={styles.sortLabel}>Sort</Text>
              {SORTS.map((option) => {
                const isActive = sort === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSort(option.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      styles.sortChip,
                      isActive && styles.sortChipActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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

        <WordActionsSheet
          word={actionsWord}
          canReRecord={!!actionsWord?.audio_url && !!user?.id}
          canDelete={!!actionsWord && (!!user?.id || isPendingWordId(actionsWord.id))}
          deleting={!!actionsWord && deletingId === actionsWord.id}
          onClose={() => setActionsWordId(null)}
          onReRecord={() => {
            // The recording UI is the row's own timer and stop button, so get out of the way.
            if (!actionsWord) return;
            setActionsWordId(null);
            handleRecord(actionsWord);
          }}
          onDelete={() => {
            if (actionsWord) handleDelete(actionsWord);
          }}
        />
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
  searchWrap: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    justifyContent: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  sortLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontFamily: FontFamily.bodySemi,
    marginRight: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sortChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  sortChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bodySemi,
  },
  sortChipTextActive: {
    color: '#fff',
  },
  searchClear: {
    position: 'absolute',
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
  },
  searchInput: {
    padding: Spacing.md,
    // Leave room for the clear button on the right.
    paddingRight: 44,
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
  wordRowPressed: {
    opacity: 0.6,
  },
  rowHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.lg,
    borderWidth: 3,
    borderColor: Colors.secondary,
  },
  // Kashmiri and English read across one line, Kashmiri leading.
  wordMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  kashmiri: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.kashmiri(FontSize.lg),
    fontFamily: FontFamily.kashmiri,
    color: Colors.accent,
    // Long phrases wrap instead of pushing the English off the card.
    flexShrink: 1,
  },
  english: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.textSecondary,
    // Right-aligned and grown to fill the gap, so the gloss ends against the
    // play/record button at the same place on every row instead of trailing the
    // Kashmiri to a different spot each time.
    textAlign: 'right',
    // Basis 'auto' rather than flex: 1 — with a basis of 0 a wide Kashmiri phrase
    // would squeeze the gloss down to nothing. Shrinking faster than the Kashmiri
    // keeps a long gloss from wrapping the word the learner is here for.
    flexGrow: 1,
    flexShrink: 3,
    flexBasis: 'auto',
  },
  // Sized to its controls, so the gloss to its left ends right beside the button
  // rather than beside an empty reserved column.
  audioActions: {
    marginLeft: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  kashmiriRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pronunciationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  draftDiscard: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftDiscardText: {
    color: Colors.wrong,
    fontSize: 16,
    fontFamily: FontFamily.bodyBold,
    lineHeight: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.xl,
  },
});
