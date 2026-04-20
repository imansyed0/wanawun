import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';
import { playAudio, stopAudio } from '@/src/services/audioService';
import { getGlossaryWords } from '@/src/services/wordService';
import { useAuth } from '@/src/hooks/useAuth';
import type { WordEntry } from '@/src/types';

type FlashcardDirection = 'kashmiri_to_english' | 'english_to_kashmiri';

function shuffleWords(words: WordEntry[]): WordEntry[] {
  return [...words].sort(() => Math.random() - 0.5);
}

function pickFlashcardDirection(): FlashcardDirection {
  return Math.random() < 0.5 ? 'kashmiri_to_english' : 'english_to_kashmiri';
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
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isCompactHeight = height < 820;
  const isShortHeight = height < 760;
  const actionBarHeight = isCompactHeight ? 60 : 72;
  const footerReserve = actionBarHeight + Spacing.lg;
  const swipeThreshold = Math.max(40, Math.min(88, width * 0.18));
  const swipeDismissDistance = width + 140;
  const deckHeight = Math.max(
    isShortHeight ? 240 : 300,
    Math.min(
      isShortHeight ? 340 : 420,
      height -
        (insets.top +
          tabBarHeight +
          insets.bottom +
          footerReserve +
          (isShortHeight ? 235 : 300))
    )
  );

  const [words, setWords] = useState<WordEntry[]>([]);
  const [currentWord, setCurrentWord] = useState<WordEntry | null>(null);
  const [currentFromWrongPool, setCurrentFromWrongPool] = useState(false);
  const [currentDirection, setCurrentDirection] = useState<FlashcardDirection>('kashmiri_to_english');
  const [remainingRandomWords, setRemainingRandomWords] = useState<WordEntry[]>([]);
  const [wrongWords, setWrongWords] = useState<WordEntry[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);
  const swipeX = useRef(new Animated.Value(0)).current;

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
        setCurrentDirection(pickFlashcardDirection());
        setWrongWords(source === 'wrong' ? pickedRest : nextWrongWords);
        setRemainingRandomWords(source === 'random' ? pickedRest : nextRandomWords);
        setRevealed(false);
        swipeX.setValue(0);
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
    [swipeX]
  );

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGlossaryWords(user?.id);
      const shuffledWords = shuffleWords(data);

      setWords(data);
      setWrongWords([]);
      setCurrentWord(shuffledWords[0] ?? null);
      setCurrentDirection(pickFlashcardDirection());
      setCurrentFromWrongPool(false);
      setRemainingRandomWords(shuffledWords.slice(1));
      setRevealed(false);
      setCorrectCount(0);
      setWrongCount(0);
      setCycleCount(1);
      setPlayingId(null);
      swipeX.setValue(0);
    } catch {
      setWords([]);
      setWrongWords([]);
      setCurrentWord(null);
      setCurrentFromWrongPool(false);
      setRemainingRandomWords([]);
      setRevealed(false);
      swipeX.setValue(0);
    } finally {
      setLoading(false);
    }
  }, [swipeX, user?.id]);

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

  useEffect(() => {
    swipeX.setValue(0);
  }, [currentWord?.id, revealed, swipeX]);

  const handlePlayAudio = useCallback(async () => {
    if (!currentWord?.audio_url) return;

    if (playingId === currentWord.id) {
      await stopAudio();
      setPlayingId(null);
      return;
    }

    setPlayingId(currentWord.id);
    try {
      await playAudio(currentWord.audio_url, {
        onFinish: () => setPlayingId(null),
      });
    } catch (error) {
      console.error('Flashcard playback error:', error);
      setPlayingId(null);
    }
  }, [currentWord, playingId]);

  const handleAnswer = useCallback(
    (wasCorrect: boolean) => {
      if (!currentWord) return;

      if (wasCorrect) {
        setCorrectCount((value) => value + 1);
      } else {
        setWrongCount((value) => value + 1);
      }

      const updatedWrongWords = wasCorrect ? wrongWords : [...wrongWords, currentWord];

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

  const animateSwipe = useCallback(
    (wasCorrect: boolean) => {
      Animated.timing(swipeX, {
        toValue: wasCorrect ? swipeDismissDistance : -swipeDismissDistance,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        swipeX.setValue(0);
        handleAnswer(wasCorrect);
      });
    },
    [handleAnswer, swipeDismissDistance, swipeX]
  );

  const resetSwipe = useCallback(() => {
    Animated.spring(swipeX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 10,
    }).start();
  }, [swipeX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => revealed,
      onStartShouldSetPanResponderCapture: () => revealed,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        revealed &&
        Math.abs(gestureState.dx) > 2 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 0.75,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) =>
        revealed &&
        Math.abs(gestureState.dx) > 2 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 0.75,
      onPanResponderGrant: () => {
        swipeX.stopAnimation();
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (!revealed) {
          swipeX.setValue(0);
          return;
        }

        swipeX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (!revealed) {
          swipeX.setValue(0);
          return;
        }

        if (gestureState.dx > swipeThreshold) {
          animateSwipe(true);
          return;
        }

        if (gestureState.dx < -swipeThreshold) {
          animateSwipe(false);
          return;
        }

        resetSwipe();
      },
      onPanResponderTerminate: resetSwipe,
    })
  ).current;

  const promptLabel =
    currentDirection === 'kashmiri_to_english' ? 'Kashmiri' : 'English';
  const promptText =
    currentDirection === 'kashmiri_to_english'
      ? currentWord?.kashmiri
      : currentWord?.english;
  const answerLabel =
    currentDirection === 'kashmiri_to_english' ? 'English' : 'Kashmiri';
  const answerText =
    currentDirection === 'kashmiri_to_english'
      ? currentWord?.english
      : currentWord?.kashmiri;
  const hasAudio = Boolean(currentWord?.audio_url);
  const promptWordCount = promptText?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  const answerWordCount = answerText?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  const promptCharCount = promptText?.length ?? 0;
  const answerCharCount = answerText?.length ?? 0;
  const useCondensedPrompt =
    isCompactHeight && (promptWordCount >= 4 || promptCharCount >= 26);
  const useUltraCondensedPrompt =
    isShortHeight && (promptWordCount >= 5 || promptCharCount >= 34);
  const useCondensedAnswer =
    isCompactHeight && (answerWordCount >= 4 || answerCharCount >= 26);
  const useUltraCondensedAnswer =
    isShortHeight && (answerWordCount >= 5 || answerCharCount >= 34);
  const topCardRotate = swipeX.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-11deg', '0deg', '11deg'],
    extrapolate: 'clamp',
  });
  const rightBadgeOpacity = swipeX.interpolate({
    inputRange: [12, swipeThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const leftBadgeOpacity = swipeX.interpolate({
    inputRange: [-swipeThreshold, -12],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const topCardStyle = {
    transform: [{ translateX: swipeX }, { rotate: topCardRotate }],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View
        style={[
          styles.screen,
          {
            paddingBottom: tabBarHeight + insets.bottom + Spacing.md,
          },
        ]}
      >
        <View style={[styles.header, isCompactHeight && styles.headerCompact]}>
          <Text style={[styles.title, isShortHeight && styles.titleShort]}>Flashcards</Text>
        </View>

        {!isShortHeight ? <ScreenHeaderDecoration variant="saffron" /> : null}

        <View style={[styles.statsRow, isCompactHeight && styles.statsRowCompact]}>
          <Card style={[styles.statCard, isShortHeight && styles.statCardShort]}>
            <Text style={styles.statLabel}>Right</Text>
            <Text
              style={[
                styles.statValue,
                styles.correctValue,
                isShortHeight && styles.statValueShort,
              ]}
            >
              {correctCount}
            </Text>
          </Card>
          <Card style={[styles.statCard, isShortHeight && styles.statCardShort]}>
            <Text style={styles.statLabel}>Wrong</Text>
            <Text
              style={[
                styles.statValue,
                styles.wrongValue,
                isShortHeight && styles.statValueShort,
              ]}
            >
              {wrongCount}
            </Text>
          </Card>
        </View>

        <View style={styles.deckArea}>
          {loading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : !currentWord ? (
            <View style={styles.centeredState}>
              <Text style={styles.emptyText}>
                Your flashcards will appear once you start completing lessons and adding
                vocabulary.
              </Text>
            </View>
          ) : (
            <View style={styles.deckContent}>
              <View
                style={[
                  styles.deckViewport,
                  isCompactHeight && styles.deckViewportCompact,
                  { height: deckHeight },
                ]}
              >
                <Animated.View
                  style={[styles.topCardFrame, topCardStyle]}
                  {...(revealed ? panResponder.panHandlers : {})}
                >
                  <Card
                    style={[
                      styles.flashcard,
                      isCompactHeight && styles.flashcardCompact,
                      isShortHeight && styles.flashcardShort,
                    ]}
                  >
                    {revealed ? (
                      <>
                        <Animated.View
                          style={[
                            styles.swipeBadge,
                            styles.swipeBadgeLeft,
                            { opacity: leftBadgeOpacity },
                          ]}
                        >
                          <Text style={[styles.swipeBadgeText, styles.swipeBadgeTextWrong]}>
                            Wrong
                          </Text>
                        </Animated.View>
                        <Animated.View
                          style={[
                            styles.swipeBadge,
                            styles.swipeBadgeRight,
                            { opacity: rightBadgeOpacity },
                          ]}
                        >
                          <Text style={[styles.swipeBadgeText, styles.swipeBadgeTextRight]}>
                            Right
                          </Text>
                        </Animated.View>
                      </>
                    ) : null}

                    <View style={styles.cardContent}>
                      <View
                        style={[
                          styles.promptSection,
                          !revealed && styles.promptSectionUnrevealed,
                          revealed && styles.promptSectionRevealed,
                        ]}
                      >
                        <Text style={styles.promptLabel}>{promptLabel}</Text>
                        <Text
                          style={[
                            styles.kashmiri,
                            isCompactHeight && styles.kashmiriCompact,
                            isShortHeight && styles.kashmiriShort,
                            useCondensedPrompt && styles.kashmiriCondensed,
                            useUltraCondensedPrompt && styles.kashmiriUltraCondensed,
                          ]}
                          numberOfLines={isShortHeight ? 3 : 4}
                          adjustsFontSizeToFit
                          minimumFontScale={isShortHeight ? 0.72 : 0.78}
                        >
                          {promptText}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.cardActionsRow,
                          !hasAudio && styles.cardActionsRowHidden,
                        ]}
                      >
                        {hasAudio ? (
                          <Pressable
                            style={[
                              styles.audioPill,
                              isCompactHeight && styles.audioPillCompact,
                              playingId === currentWord.id && styles.audioPillActive,
                            ]}
                            onPress={handlePlayAudio}
                          >
                            <Text
                              style={[
                                styles.audioPillText,
                                isCompactHeight && styles.audioPillTextCompact,
                                playingId === currentWord.id && styles.audioPillTextActive,
                              ]}
                            >
                              {playingId === currentWord.id ? '\u23F9' : '\uD83D\uDD0A'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {revealed ? (
                        <View
                          style={[
                            styles.answerBox,
                            isCompactHeight && styles.answerBoxCompact,
                            isShortHeight && styles.answerBoxShort,
                          ]}
                        >
                          <>
                            <Text style={styles.answerLabel}>{answerLabel}</Text>
                            <Text
                              style={[
                                styles.answerText,
                                isCompactHeight && styles.answerTextCompact,
                                isShortHeight && styles.answerTextShort,
                                useCondensedAnswer && styles.answerTextCondensed,
                                useUltraCondensedAnswer && styles.answerTextUltraCondensed,
                              ]}
                              numberOfLines={isShortHeight ? 3 : 4}
                              adjustsFontSizeToFit
                              minimumFontScale={0.62}
                            >
                              {answerText}
                            </Text>
                          </>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                </Animated.View>
              </View>
              {revealed ? (
                <View style={styles.swipeHintRow}>
                  <Pressable
                    style={[styles.swipeHintPill, styles.swipeHintPillWrong]}
                    onPress={() => animateSwipe(false)}
                  >
                    <Text style={[styles.swipeHintArrow, styles.swipeHintArrowWrong]}>←</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.swipeHintPill, styles.swipeHintPillRight]}
                    onPress={() => animateSwipe(true)}
                  >
                    <Text style={[styles.swipeHintArrow, styles.swipeHintArrowRight]}>→</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actionFooter}>
                  <Button
                    title="Reveal answer"
                    onPress={() => setRevealed(true)}
                    size={isCompactHeight ? 'sm' : 'lg'}
                    style={styles.revealFooterButton}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerCompact: {
    paddingTop: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.headingBold,
    color: Colors.primaryDark,
  },
  titleShort: {
    fontSize: FontSize.xl,
  },
  subtitle: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  subtitleShort: {
    fontSize: FontSize.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  statsRowCompact: {
    marginTop: Spacing.sm,
  },
  statCard: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  statCardShort: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },
  statValueShort: {
    marginTop: 2,
    fontSize: FontSize.lg,
  },
  correctValue: {
    color: Colors.correct,
  },
  wrongValue: {
    color: Colors.wrong,
  },
  deckArea: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    justifyContent: 'center',
  },
  deckContent: {
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  deckViewport: {
    alignSelf: 'stretch',
  },
  deckViewportCompact: {
    marginTop: 0,
  },
  topCardFrame: {
    width: '100%',
    height: '100%',
  },
  flashcard: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  flashcardCompact: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  flashcardShort: {
    paddingVertical: Spacing.sm,
  },
  swipeBadge: {
    position: 'absolute',
    top: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    zIndex: 2,
  },
  swipeBadgeLeft: {
    left: 16,
    borderColor: Colors.wrong,
  },
  swipeBadgeRight: {
    right: 16,
    borderColor: Colors.correct,
  },
  swipeBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  swipeBadgeTextWrong: {
    color: Colors.wrong,
  },
  swipeBadgeTextRight: {
    color: Colors.correct,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  promptSection: {
    flex: 1,
    flexBasis: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  promptSectionUnrevealed: {
    flexGrow: 1,
    flexShrink: 1,
  },
  promptSectionRevealed: {
    flexGrow: 1.45,
    flexShrink: 1,
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
    fontFamily: FontFamily.headingBold,
    color: Colors.accent,
    textAlign: 'center',
  },
  kashmiriCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  kashmiriShort: {
    fontSize: 22,
    lineHeight: 28,
  },
  kashmiriCondensed: {
    fontSize: 24,
    lineHeight: 30,
  },
  kashmiriUltraCondensed: {
    fontSize: 18,
    lineHeight: 24,
  },
  cardActionsRow: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionsRowHidden: {
    minHeight: 0,
  },
  audioPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPillCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  audioPillActive: {
    backgroundColor: Colors.primary,
  },
  audioPillText: {
    fontSize: 22,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  audioPillTextCompact: {
    fontSize: 18,
  },
  audioPillTextActive: {
    color: '#fff',
  },
  answerBox: {
    minHeight: 82,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  answerBoxCompact: {
    minHeight: 64,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  answerBoxShort: {
    minHeight: 54,
    paddingVertical: 6,
  },
  answerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  answerText: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
    color: Colors.text,
    textAlign: 'center',
  },
  answerTextCompact: {
    fontSize: FontSize.lg,
    lineHeight: 24,
  },
  answerTextShort: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  answerTextCondensed: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  answerTextUltraCondensed: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  actionFooter: {
    paddingHorizontal: Spacing.md,
  },
  swipeHintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  swipeHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  swipeHintPillWrong: {
    borderColor: '#e1b7b1',
  },
  swipeHintPillRight: {
    borderColor: '#b8d5c7',
  },
  swipeHintArrow: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodyBold,
  },
  swipeHintArrowWrong: {
    color: Colors.wrong,
  },
  swipeHintArrowRight: {
    color: Colors.correct,
  },
  revealFooterButton: {
    width: '100%',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
