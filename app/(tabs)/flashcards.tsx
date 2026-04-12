import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ChinarLeaf } from '@/src/components/ui/ChinarLeaf';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { BorderRadius, Colors, FontSize, Spacing } from '@/src/constants/theme';
import { playAudio, stopAudio } from '@/src/services/audioService';
import { getGlossaryWords } from '@/src/services/wordService';
import { useAuth } from '@/src/hooks/useAuth';
import type { WordEntry } from '@/src/types';

function shuffleWords(words: WordEntry[]): WordEntry[] {
  return [...words].sort(() => Math.random() - 0.5);
}

function takeNextDistinctWord(
  queue: WordEntry[],
  excludedWordId?: string | null
): { nextWord: WordEntry | null; rest: WordEntry[] } {
  if (queue.length === 0) {
    return { nextWord: null, rest: [] };
  }

  const distinctIndex = queue.findIndex((word) => word.id !== excludedWordId);
  const index = distinctIndex >= 0 ? distinctIndex : 0;
  const nextWord = queue[index] ?? null;

  return {
    nextWord,
    rest: queue.filter((_, currentIndex) => currentIndex !== index),
  };
}

export default function FlashcardsScreen() {
  const { user } = useAuth();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [currentWord, setCurrentWord] = useState<WordEntry | null>(null);
  const [currentFromWrongPool, setCurrentFromWrongPool] = useState(false);
  const [remainingRandomWords, setRemainingRandomWords] = useState<WordEntry[]>([]);
  const [wrongWords, setWrongWords] = useState<WordEntry[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);

  const drawNextCard = useCallback(
    (
      allWords: WordEntry[],
      nextWrongWords: WordEntry[],
      nextRandomWords: WordEntry[],
      excludedWordId?: string | null,
      preferWrongPool: boolean = true
    ) => {
      if (allWords.length === 0) {
        setCurrentWord(null);
        setCurrentFromWrongPool(false);
        setWrongWords([]);
        setRemainingRandomWords([]);
        setRevealed(false);
        return;
      }

      const refreshedRandomWords =
        nextRandomWords.length > 0 ? nextRandomWords : shuffleWords(allWords);
      const wrongPick = takeNextDistinctWord(nextWrongWords, excludedWordId);
      const randomPick = takeNextDistinctWord(refreshedRandomWords, excludedWordId);
      const firstPick = preferWrongPool ? wrongPick : randomPick;
      const secondPick = preferWrongPool ? randomPick : wrongPick;
      const firstSource = preferWrongPool ? 'wrong' : 'random';
      const secondSource = preferWrongPool ? 'random' : 'wrong';

      const applyPick = (
        source: 'wrong' | 'random',
        pickedWord: WordEntry | null,
        pickedRest: WordEntry[]
      ) => {
        if (!pickedWord) return false;
        setCurrentWord(pickedWord);
        setCurrentFromWrongPool(source === 'wrong');
        setWrongWords(source === 'wrong' ? pickedRest : nextWrongWords);
        setRemainingRandomWords(source === 'random' ? pickedRest : nextRandomWords);
        setRevealed(false);
        return true;
      };

      if (applyPick(firstSource, firstPick.nextWord, firstPick.rest)) {
        return;
      }

      if (applyPick(secondSource, secondPick.nextWord, secondPick.rest)) {
        return;
      }

      const fallbackRandomPick = takeNextDistinctWord(refreshedRandomWords);
      if (applyPick('random', fallbackRandomPick.nextWord, fallbackRandomPick.rest)) {
        return;
      }

      applyPick('wrong', wrongPick.nextWord, wrongPick.rest);
    },
    []
  );

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGlossaryWords(user?.id);
      const shuffledWords = shuffleWords(data);

      setWords(data);
      setWrongWords([]);
      setCurrentWord(shuffledWords[0] ?? null);
      setCurrentFromWrongPool(false);
      setRemainingRandomWords(shuffledWords.slice(1));
      setRevealed(false);
      setCorrectCount(0);
      setWrongCount(0);
      setCycleCount(1);
      setPlayingId(null);
    } catch {
      setWords([]);
      setWrongWords([]);
      setCurrentWord(null);
      setCurrentFromWrongPool(false);
      setRemainingRandomWords([]);
      setRevealed(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadWords();

      return () => {
        stopAudio();
      };
    }, [loadWords])
  );

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const handlePlayAudio = useCallback(async () => {
    if (!currentWord?.audio_url) return;

    if (playingId === currentWord.id) {
      await stopAudio();
      setPlayingId(null);
      return;
    }

    setPlayingId(currentWord.id);
    try {
      await playAudio(currentWord.audio_url);
    } catch (error) {
      console.error('Flashcard playback error:', error);
    }
    setPlayingId(null);
  }, [currentWord, playingId]);

  const handleAnswer = useCallback(
    (wasCorrect: boolean) => {
      if (!currentWord) return;

      if (wasCorrect) {
        setCorrectCount((value) => value + 1);
      } else {
        setWrongCount((value) => value + 1);
      }

      const updatedWrongWords = wasCorrect
        ? wrongWords
        : [...wrongWords, currentWord];

      if (currentFromWrongPool && wasCorrect && updatedWrongWords.length === 0) {
        const resetRandomWords = shuffleWords(words);
        setCycleCount((value) => value + 1);
        drawNextCard(words, [], resetRandomWords, currentWord.id, false);
        return;
      }

      drawNextCard(
        words,
        updatedWrongWords,
        remainingRandomWords,
        currentWord.id,
        currentFromWrongPool
      );
    },
    [currentFromWrongPool, currentWord, drawNextCard, remainingRandomWords, words, wrongWords]
  );

  const modeTitle =
    wrongWords.length > 0 ? 'Retry wrong cards first' : 'Random glossary cards';
  const modeText =
    wrongWords.length > 0
      ? `${wrongWords.length} missed card${wrongWords.length === 1 ? '' : 's'} left before the deck resets.`
      : 'Cards are random until you miss one. Missed cards stay in the retry pool but the next card changes when possible.';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Flashcards</Text>
        <Text style={styles.subtitle}>
          {words.length} glossary card{words.length === 1 ? '' : 's'}
        </Text>
      </View>

      <ScreenHeaderDecoration variant="saffron" />

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Cycle</Text>
          <Text style={styles.statValue}>{cycleCount}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Right</Text>
          <Text style={[styles.statValue, styles.correctValue]}>{correctCount}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Wrong</Text>
          <Text style={[styles.statValue, styles.wrongValue]}>{wrongCount}</Text>
        </Card>
      </View>

      <Card style={styles.modeCard}>
        <Text style={styles.modeTitle}>{modeTitle}</Text>
        <Text style={styles.modeText}>{modeText}</Text>
      </Card>

      <View style={styles.cardArea}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} />
        ) : !currentWord ? (
          <Text style={styles.emptyText}>
            Your flashcards will appear once you start completing lessons and adding vocabulary.
          </Text>
        ) : (
          <Card style={styles.flashcard}>
            <ChinarLeaf size={48} color={Colors.primary} opacity={0.06} style={styles.flashcardLeaf} />
            <Text style={styles.promptLabel}>Kashmiri</Text>
            <Text style={styles.kashmiri}>{currentWord.kashmiri}</Text>
            {currentWord.audio_url ? (
              <Pressable
                style={[styles.audioPill, playingId === currentWord.id && styles.audioPillActive]}
                onPress={handlePlayAudio}
              >
                <Text
                  style={[
                    styles.audioPillText,
                    playingId === currentWord.id && styles.audioPillTextActive,
                  ]}
                >
                  {playingId === currentWord.id ? '⏹' : '🔊'}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>Answer</Text>
              <Text style={styles.answerText}>
                {revealed ? currentWord.english : 'Tap reveal when you want to check'}
              </Text>
            </View>

            {!revealed ? (
              <Button title="Reveal answer" onPress={() => setRevealed(true)} size="lg" />
            ) : (
              <View style={styles.answerActions}>
                <Button
                  title="I got it wrong"
                  onPress={() => handleAnswer(false)}
                  variant="secondary"
                  style={styles.answerButton}
                />
                <Button
                  title="I got it right"
                  onPress={() => handleAnswer(true)}
                  style={styles.answerButton}
                />
              </View>
            )}
          </Card>
        )}
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
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  correctValue: {
    color: Colors.correct,
  },
  wrongValue: {
    color: Colors.wrong,
  },
  modeCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: '#f0f7f3',
    borderWidth: 1,
    borderColor: '#cfe7d8',
    padding: Spacing.md,
  },
  modeTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  modeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  cardArea: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  flashcard: {
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  flashcardLeaf: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  promptLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  kashmiri: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.accent,
    textAlign: 'center',
  },
  audioPill: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  audioPillActive: {
    backgroundColor: Colors.primary,
  },
  audioPillText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  audioPillTextActive: {
    color: '#fff',
  },
  answerBox: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  answerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  answerText: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  answerActions: {
    gap: Spacing.sm,
  },
  answerButton: {
    width: '100%',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
