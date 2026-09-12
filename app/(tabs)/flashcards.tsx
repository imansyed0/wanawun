import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BorderRadius, Colors, FontFamily, FontSize, LineHeight, Spacing } from '@/src/constants/theme';
import { playAudio, stopAudio } from '@/src/services/audioService';
import { getGlossaryWords } from '@/src/services/wordService';
import { loadDeck, saveCardReview, type DeckItem } from '@/src/services/srsService';
import {
  formatDuration,
  pickNextCard,
  previewIntervals,
  reviewCard,
  summarizeQueue,
  REVIEW_RATINGS,
  type ReviewRating,
} from '@/src/lib/srs';
import { useAuth } from '@/src/hooks/useAuth';
import { useTutorialStore } from '@/src/stores/tutorialStore';

/** How often the due counters and queue re-evaluate against the clock. */
const CLOCK_TICK_MS = 20 * 1000;

const RATING_LABEL: Record<ReviewRating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

const STATE_LABEL = {
  new: 'New',
  learning: 'Learning',
  review: 'Review',
  relearning: 'Relearning',
} as const;

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

  const [deck, setDeck] = useState<DeckItem[]>([]);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  // Sticky for the session: lets the user drill a deck that has nothing due.
  const [studyAhead, setStudyAhead] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const swipeX = useRef(new Animated.Value(0)).current;

  const current = useMemo(
    () => deck.find((item) => item.card.key === currentKey) ?? null,
    [deck, currentKey]
  );
  const cards = useMemo(() => deck.map((item) => item.card), [deck]);
  const summary = useMemo(() => summarizeQueue(cards, nowTick), [cards, nowTick]);
  // Study-ahead keeps dealing cards after the queue is legitimately empty. Say
  // so on screen — otherwise the counters read zero while cards keep arriving,
  // and there is no way back out of the mode.
  const isReviewingAhead = studyAhead && summary.dueTotal === 0;

  const stopReviewingAhead = useCallback(() => {
    setStudyAhead(false);
    setCurrentKey(null);
    setRevealed(false);
  }, []);
  const intervalPreview = useMemo(
    () => (current ? previewIntervals(current.card, nowTick) : null),
    [current, nowTick]
  );

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const words = await getGlossaryWords(user?.id);
      const now = Date.now();
      const items = await loadDeck(user?.id, words, now);
      const next = pickNextCard(
        items.map((item) => item.card),
        now
      );

      setDeck(items);
      setCurrentKey(next?.key ?? null);
      setNowTick(now);
      setStudyAhead(false);
      setReviewedCount(0);
      setRevealed(false);
      setPlayingId(null);
      swipeX.setValue(0);
    } catch {
      setDeck([]);
      setCurrentKey(null);
      setRevealed(false);
      swipeX.setValue(0);
    } finally {
      setLoading(false);
    }
  }, [swipeX, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadCards();

      const timer = setInterval(() => setNowTick(Date.now()), CLOCK_TICK_MS);

      return () => {
        clearInterval(timer);
        stopAudio();
      };
    }, [loadCards])
  );

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  useEffect(() => {
    swipeX.setValue(0);
  }, [currentKey, revealed, swipeX]);

  // Learning cards come due minutes apart, so a deck that ran dry can refill
  // on its own while the user is still on the screen.
  useEffect(() => {
    if (loading || currentKey !== null || deck.length === 0) return;

    const next = pickNextCard(
      deck.map((item) => item.card),
      nowTick,
      { studyAhead }
    );
    if (next) setCurrentKey(next.key);
  }, [currentKey, deck, loading, nowTick, studyAhead]);

  const handlePlayAudio = useCallback(async () => {
    const audioUrl = current?.word.audio_url;
    if (!current || !audioUrl) return;

    if (playingId === current.word.id) {
      await stopAudio();
      setPlayingId(null);
      return;
    }

    setPlayingId(current.word.id);
    try {
      await playAudio(audioUrl, {
        onFinish: () => setPlayingId(null),
      });
    } catch (error) {
      console.error('Flashcard playback error:', error);
      setPlayingId(null);
    }
  }, [current, playingId]);

  const handleRate = useCallback(
    (rating: ReviewRating) => {
      if (!current) return;

      const now = Date.now();
      const graded = reviewCard(current.card, rating, now);

      useTutorialStore.getState().notify('flashcardAnswered', {
        wasCorrect: rating !== 'again',
      });
      setReviewedCount((value) => value + 1);

      const nextDeck = deck.map((item) =>
        item.card.key === graded.key ? { ...item, card: graded } : item
      );
      const next = pickNextCard(
        nextDeck.map((item) => item.card),
        now,
        { excludeKey: graded.key, studyAhead }
      );

      setDeck(nextDeck);
      setCurrentKey(next?.key ?? null);
      setNowTick(now);
      setRevealed(false);
      swipeX.setValue(0);

      saveCardReview(user?.id, graded, current.word).catch((error) => {
        // The local cache already has it; the next load will retry the sync.
        console.error('Flashcard review sync failed:', error);
      });
    },
    [current, deck, studyAhead, swipeX, user?.id]
  );

  const animateSwipe = useCallback(
    (rating: 'again' | 'good') => {
      Animated.timing(swipeX, {
        toValue: rating === 'good' ? swipeDismissDistance : -swipeDismissDistance,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        swipeX.setValue(0);
        handleRate(rating);
      });
    },
    [handleRate, swipeDismissDistance, swipeX]
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
          animateSwipe('good');
          return;
        }

        if (gestureState.dx < -swipeThreshold) {
          animateSwipe('again');
          return;
        }

        resetSwipe();
      },
      onPanResponderTerminate: resetSwipe,
    })
  ).current;

  const showsKashmiriPrompt = current?.direction === 'k2e';
  const promptLabel = showsKashmiriPrompt ? 'Kashmiri' : 'English';
  const promptText = showsKashmiriPrompt ? current?.word.kashmiri : current?.word.english;
  const answerLabel = showsKashmiriPrompt ? 'English' : 'Kashmiri';
  const answerText = showsKashmiriPrompt ? current?.word.english : current?.word.kashmiri;
  // Playing the Kashmiri audio before an English->Kashmiri card is revealed
  // would hand over the answer.
  const hasAudio = Boolean(current?.word.audio_url) && (showsKashmiriPrompt || revealed);
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
  // The ladder below steps the type down to fit short screens. Amiri needs a
  // far taller line box than Rozha One does, so the line height has to follow
  // both the tier that won and which script is on that side of the card — one
  // fixed value would slice the vowel marks off the Kashmiri.
  const promptFontSize = useUltraCondensedPrompt
    ? 18
    : useCondensedPrompt
      ? 24
      : isShortHeight
        ? 22
        : isCompactHeight
          ? 28
          : FontSize.title;
  const answerFontSize = useUltraCondensedAnswer
    ? FontSize.xs
    : useCondensedAnswer
      ? FontSize.sm
      : isShortHeight
        ? FontSize.md
        : isCompactHeight
          ? FontSize.lg
          : FontSize.xl;
  const promptLineHeight = showsKashmiriPrompt
    ? LineHeight.kashmiri(promptFontSize)
    : LineHeight.heading(promptFontSize);
  const answerLineHeight = showsKashmiriPrompt
    ? LineHeight.heading(answerFontSize)
    : LineHeight.kashmiri(answerFontSize);
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

  const nextDueLabel =
    summary.nextDueAt !== null
      ? `Next review in ${formatDuration(summary.nextDueAt - nowTick)}`
      : null;

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
          <Text style={[styles.subtitle, isShortHeight && styles.subtitleShort]}>
            {reviewedCount > 0
              ? `${reviewedCount} reviewed this session`
              : 'Spaced repetition — a little every day'}
          </Text>
        </View>

        {isReviewingAhead ? (
          <View style={styles.aheadBanner}>
            <Text style={styles.aheadText} numberOfLines={2}>
              Reviewing ahead — you're done for today
            </Text>
            <Pressable style={styles.aheadStop} onPress={stopReviewingAhead}>
              <Text style={styles.aheadStopText}>Stop</Text>
            </Pressable>
          </View>
        ) : null}

        {!isShortHeight ? <ScreenHeaderDecoration variant="saffron" /> : null}

        <View style={[styles.statsRow, isCompactHeight && styles.statsRowCompact]}>
          <Card style={[styles.statCard, isShortHeight && styles.statCardShort]}>
            <Text style={styles.statLabel}>New</Text>
            <Text
              style={[styles.statValue, styles.newValue, isShortHeight && styles.statValueShort]}
            >
              {summary.newCount}
            </Text>
          </Card>
          <Card style={[styles.statCard, isShortHeight && styles.statCardShort]}>
            <Text style={styles.statLabel}>Learning</Text>
            <Text
              style={[
                styles.statValue,
                styles.learningValue,
                isShortHeight && styles.statValueShort,
              ]}
            >
              {summary.learningCount}
            </Text>
          </Card>
          <Card style={[styles.statCard, isShortHeight && styles.statCardShort]}>
            <Text style={styles.statLabel}>Due</Text>
            <Text
              style={[styles.statValue, styles.dueValue, isShortHeight && styles.statValueShort]}
            >
              {summary.reviewCount}
            </Text>
          </Card>
        </View>

        <View style={styles.deckArea}>
          {loading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : deck.length === 0 ? (
            <View style={styles.centeredState}>
              <Text style={styles.emptyText}>
                Your flashcards will appear once you start completing lessons and adding
                vocabulary.
              </Text>
            </View>
          ) : !current ? (
            <View style={styles.centeredState}>
              <Text style={styles.caughtUpTitle}>All caught up</Text>
              <Text style={styles.emptyText}>
                {nextDueLabel
                  ? `${nextDueLabel}. Coming back on schedule is what makes it stick.`
                  : 'Nothing is due right now.'}
              </Text>
              <Button
                title="Review ahead"
                variant="outline"
                onPress={() => setStudyAhead(true)}
                style={styles.reviewAheadButton}
              />
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
                            Again
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
                            Good
                          </Text>
                        </Animated.View>
                      </>
                    ) : null}

                    <View style={styles.cardContent}>
                      <View style={styles.stateChipRow}>
                        <View style={styles.stateChip}>
                          <Text style={styles.stateChipText}>
                            {STATE_LABEL[current.card.state]}
                            {current.card.state === 'review' && current.card.intervalDays > 0
                              ? ` · ${formatDuration(current.card.intervalDays * 86400000)}`
                              : ''}
                          </Text>
                        </View>
                      </View>

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
                            showsKashmiriPrompt && styles.kashmiriFont,
                            { lineHeight: promptLineHeight },
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
                              playingId === current.word.id && styles.audioPillActive,
                            ]}
                            onPress={handlePlayAudio}
                          >
                            <Text
                              style={[
                                styles.audioPillText,
                                isCompactHeight && styles.audioPillTextCompact,
                                playingId === current.word.id && styles.audioPillTextActive,
                              ]}
                            >
                              {playingId === current.word.id ? '⏹' : '🔊'}
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
                          <Text style={styles.answerLabel}>{answerLabel}</Text>
                          <Text
                            style={[
                              styles.answerText,
                              isCompactHeight && styles.answerTextCompact,
                              isShortHeight && styles.answerTextShort,
                              useCondensedAnswer && styles.answerTextCondensed,
                              useUltraCondensedAnswer && styles.answerTextUltraCondensed,
                              !showsKashmiriPrompt && styles.kashmiriFont,
                              { lineHeight: answerLineHeight },
                            ]}
                            numberOfLines={isShortHeight ? 3 : 4}
                            adjustsFontSizeToFit
                            minimumFontScale={0.62}
                          >
                            {answerText}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                </Animated.View>
              </View>
              {revealed ? (
                <View style={styles.ratingRow}>
                  {REVIEW_RATINGS.map((rating) => (
                    <Pressable
                      key={rating}
                      style={[
                        styles.ratingPill,
                        isShortHeight && styles.ratingPillShort,
                        styles[`ratingPill_${rating}`],
                      ]}
                      onPress={() => handleRate(rating)}
                    >
                      <Text style={[styles.ratingLabel, styles[`ratingLabel_${rating}`]]}>
                        {RATING_LABEL[rating]}
                      </Text>
                      <Text style={styles.ratingInterval}>{intervalPreview?.[rating]}</Text>
                    </Pressable>
                  ))}
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
  aheadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceWarm,
  },
  aheadText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemi,
    color: Colors.textSecondary,
  },
  aheadStop: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  aheadStopText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
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
  newValue: {
    color: Colors.accent,
  },
  learningValue: {
    color: Colors.secondary,
  },
  dueValue: {
    color: Colors.correct,
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
    gap: Spacing.sm,
  },
  caughtUpTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
    color: Colors.primaryDark,
  },
  reviewAheadButton: {
    marginTop: Spacing.md,
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
    gap: Spacing.sm,
  },
  stateChipRow: {
    alignItems: 'center',
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
  },
  stateChipText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemi,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
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
  kashmiriFont: {
    fontFamily: FontFamily.kashmiri,
  },
  // Sizes only — the matching line height is applied inline, because it
  // depends on which script the card is showing.
  kashmiriCompact: {
    fontSize: 28,
  },
  kashmiriShort: {
    fontSize: 22,
  },
  kashmiriCondensed: {
    fontSize: 24,
  },
  kashmiriUltraCondensed: {
    fontSize: 18,
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
  },
  answerTextShort: {
    fontSize: FontSize.md,
  },
  answerTextCondensed: {
    fontSize: FontSize.sm,
  },
  answerTextUltraCondensed: {
    fontSize: FontSize.xs,
  },
  actionFooter: {
    paddingHorizontal: Spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  ratingPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  ratingPillShort: {
    paddingVertical: 6,
  },
  ratingPill_again: {
    borderColor: '#e1b7b1',
  },
  ratingPill_hard: {
    borderColor: Colors.walnutLight,
  },
  ratingPill_good: {
    borderColor: '#BDD0C8',
  },
  ratingPill_easy: {
    borderColor: Colors.accentLight,
  },
  ratingLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyBold,
  },
  ratingLabel_again: {
    color: Colors.wrong,
  },
  ratingLabel_hard: {
    color: Colors.walnut,
  },
  ratingLabel_good: {
    color: Colors.correct,
  },
  ratingLabel_easy: {
    color: Colors.accent,
  },
  ratingInterval: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
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
