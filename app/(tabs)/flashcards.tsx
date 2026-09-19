import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {
  REVIEW_DIRECTIONS,
  cardKeyFor,
  loadDeck,
  saveCardReview,
  type DeckItem,
} from '@/src/services/srsService';
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

// Per device, not per account: closing a panel you've read is a preference of
// this phone's, and it isn't worth a round trip to the database. It does mean a
// new phone shows the explanation again, which is the right way round anyway.
const INTRO_DISMISSED_KEY = 'flashcardsIntroDismissed';

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

  // Below this the explanation and a legible card don't both fit, and the card
  // is the one they came for: it keeps shrinking politely but its own contents
  // start colliding somewhere under 200pt. The explanation stands down instead.
  const hidesIntro = height < 700;
  // Dismissed with the x and remembered: the explanation is for the first visit
  // or two, and having to read past it every time is its own annoyance. null
  // until the answer is read back, so a dismissed panel never flashes up first.
  const [introDismissed, setIntroDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(INTRO_DISMISSED_KEY)
      .then((raw) => setIntroDismissed(raw === 'true'))
      .catch(() => setIntroDismissed(false));
  }, []);
  const dismissIntro = useCallback(() => {
    setIntroDismissed(true);
    // Losing the preference is a small thing next to blocking the tap on it.
    AsyncStorage.setItem(INTRO_DISMISSED_KEY, 'true').catch(() => {});
  }, []);
  const showsIntro = !hidesIntro && introDismissed === false;
  // Only a ceiling, so the card doesn't sprawl on a tablet. The deck is a flex
  // item inside a flex:1 area and already takes exactly what is free; working
  // this out from the screen's chrome instead just guessed low and left the
  // card smaller than the space it had, with its answer clipped off the bottom.
  const deckHeight = isShortHeight ? 340 : 420;
  // How much room the card actually got. The window's height is a poor proxy:
  // the same 800pt screen gives a roomy card with the explanation closed and a
  // cramped one with it open, so keying the card's own type sizes to the window
  // let its contents overrun it between the breakpoints.
  const [cardHeight, setCardHeight] = useState(0);
  const cardCompact = cardHeight > 0 && cardHeight < 300;
  const cardShort = cardHeight > 0 && cardHeight < 250;

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
        {
          // Hold back both the card just answered and the same word the other
          // way round, so "salām -> hello" isn't followed by "hello -> salām".
          excludeKeys: REVIEW_DIRECTIONS.map((direction) =>
            cardKeyFor(current.word, direction)
          ),
          studyAhead,
        }
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
    cardCompact && (promptWordCount >= 4 || promptCharCount >= 26);
  const useUltraCondensedPrompt =
    cardShort && (promptWordCount >= 5 || promptCharCount >= 34);
  const useCondensedAnswer =
    cardCompact && (answerWordCount >= 4 || answerCharCount >= 26);
  const useUltraCondensedAnswer =
    cardShort && (answerWordCount >= 5 || answerCharCount >= 34);
  // The ladder below steps the type down to fit short screens. Amiri needs a
  // far taller line box than Rozha One does, so the line height has to follow
  // both the tier that won and which script is on that side of the card — one
  // fixed value would slice the vowel marks off the Kashmiri.
  const promptFontSize = useUltraCondensedPrompt
    ? 18
    : useCondensedPrompt
      ? 24
      : cardShort
        ? 22
        : cardCompact
          ? 28
          : FontSize.title;
  const answerFontSize = useUltraCondensedAnswer
    ? FontSize.xs
    : useCondensedAnswer
      ? FontSize.sm
      : cardShort
        ? FontSize.md
        : cardCompact
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View
        style={[
          styles.screen,
          {
            // tabBarHeight already includes the bottom safe-area inset, and
            // the SafeAreaView above no longer adds it a third time.
            paddingBottom: tabBarHeight + Spacing.md,
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

        {/* The wrapper, not the Card, carries onLayout: Card takes no layout
            callback, and measuring here counts the spacing above it too. */}
        {!showsIntro ? null : (
        <View style={styles.introSection}>
          <Card style={[styles.introCard, isShortHeight && styles.introCardShort]}>
            <Pressable
              style={styles.introDismiss}
              onPress={dismissIntro}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Hide this explanation"
            >
              <Text style={styles.introDismissText}>{'\u00D7'}</Text>
            </Pressable>
            <Text style={[styles.introText, isShortHeight && styles.introTextShort]}>
              Each word in your glossary becomes two cards, Kashmiri to English and
              back. Guess, then say how well you knew it. Ones you fumble come back in
              minutes, ones you know wait days.
            </Text>
          </Card>
        </View>
        )}

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
                  { maxHeight: deckHeight },
                ]}
                onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
              >
                <Animated.View
                  style={[styles.topCardFrame, topCardStyle]}
                  {...(revealed ? panResponder.panHandlers : {})}
                >
                  <Card
                    style={[
                      styles.flashcard,
                      cardCompact && styles.flashcardCompact,
                      cardShort && styles.flashcardShort,
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
                      {/* Chip, label and word travel together. Pinned to the top
                          of the card instead, the chip is left stranded above a
                          gap whenever the card has room to spare. */}
                      <View style={styles.promptSection}>
                        <View style={styles.stateChip}>
                          <Text style={styles.stateChipText}>
                            {STATE_LABEL[current.card.state]}
                            {current.card.state === 'review' && current.card.intervalDays > 0
                              ? ` · ${formatDuration(current.card.intervalDays * 86400000)}`
                              : ''}
                          </Text>
                        </View>
                        <Text style={styles.promptLabel}>{promptLabel}</Text>
                        <Text
                          style={[
                            styles.kashmiri,
                            cardCompact && styles.kashmiriCompact,
                            cardShort && styles.kashmiriShort,
                            useCondensedPrompt && styles.kashmiriCondensed,
                            useUltraCondensedPrompt && styles.kashmiriUltraCondensed,
                            showsKashmiriPrompt && styles.kashmiriFont,
                            { lineHeight: promptLineHeight },
                          ]}
                          numberOfLines={cardShort ? 3 : 4}
                          adjustsFontSizeToFit
                          minimumFontScale={cardShort ? 0.72 : 0.78}
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
                              cardCompact && styles.audioPillCompact,
                              playingId === current.word.id && styles.audioPillActive,
                            ]}
                            onPress={handlePlayAudio}
                          >
                            <Text
                              style={[
                                styles.audioPillText,
                                cardCompact && styles.audioPillTextCompact,
                                playingId === current.word.id && styles.audioPillTextActive,
                              ]}
                            >
                              {playingId === current.word.id ? '⏹' : '🔊'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {/* The slot is there from the start, empty until they
                          reveal: reserving it is what stops the prompt above
                          from shifting, and an empty box says the answer lands
                          here where a blank gap just looked like a hole. */}
                      <View
                        style={[
                          styles.answerBox,
                          cardCompact && styles.answerBoxCompact,
                          cardShort && styles.answerBoxShort,
                          !revealed && styles.answerBoxWaiting,
                        ]}
                        pointerEvents={revealed ? 'auto' : 'none'}
                        accessibilityElementsHidden={!revealed}
                        importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
                      >
                        <Text style={[styles.answerLabel, !revealed && styles.answerHidden]}>
                          {answerLabel}
                        </Text>
                        <Text
                          style={[
                            styles.answerText,
                            !revealed && styles.answerHidden,
                            cardCompact && styles.answerTextCompact,
                            cardShort && styles.answerTextShort,
                            useCondensedAnswer && styles.answerTextCondensed,
                            useUltraCondensedAnswer && styles.answerTextUltraCondensed,
                            !showsKashmiriPrompt && styles.kashmiriFont,
                            { lineHeight: answerLineHeight },
                          ]}
                          numberOfLines={cardShort ? 3 : 4}
                          adjustsFontSizeToFit
                          minimumFontScale={0.62}
                        >
                          {answerText}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              </View>
              {/* The rating pills are laid out in both states and give this area
                  its height; before the answer is revealed they are invisible
                  and the Reveal button sits over them. Swapping one control for
                  the other instead would make the taller pills shove the card
                  upwards at the exact moment the learner is reading it. */}
              <View style={styles.answerArea}>
                <View
                  style={[styles.ratingRow, !revealed && styles.answerHidden]}
                  pointerEvents={revealed ? 'auto' : 'none'}
                  accessibilityElementsHidden={!revealed}
                  importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
                >
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

                {revealed ? null : (
                  <View style={styles.actionFooter} pointerEvents="box-none">
                    <Button
                      title="Reveal answer"
                      onPress={() => setRevealed(true)}
                      size={isCompactHeight ? 'sm' : 'lg'}
                      style={styles.revealFooterButton}
                    />
                  </View>
                )}
              </View>
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
    paddingTop: Spacing.md,
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
  introSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  introDismiss: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  introDismissText: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.body(FontSize.lg),
    color: Colors.textLight,
  },
  introCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  introCardShort: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  introText: {
    paddingRight: Spacing.md,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body(FontSize.sm),
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
  },
  introTextShort: {
    fontSize: FontSize.xs,
    lineHeight: LineHeight.body(FontSize.xs),
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
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
    flex: 1,
    minHeight: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.sm,
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
  // Flex, not a fixed height: deckHeight is only a ceiling now. The deck can
  // never be taller than the space deckArea actually has, so it can't spill out
  // of it and over the stat cards -- which is what a fixed height let it do.
  deckViewport: {
    alignSelf: 'stretch',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
  },
  deckViewportCompact: {
    marginTop: 0,
  },
  topCardFrame: {
    width: '100%',
    flex: 1,
  },
  flashcard: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
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
  // Tight gaps on purpose: chip, prompt, audio and answer all have to fit
  // inside a card whose height the screen decides, and the prompt no longer
  // absorbs the shortfall by pushing its own text out of the top.
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.xs,
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
  // One share of the card whether or not the answer is showing. The answer box
  // below is laid out either way, so the prompt is handed the same box every
  // time and the word doesn't jump the moment the learner reveals it.
  promptSection: {
    flexBasis: 'auto',
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
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
    minHeight: 72,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  answerBoxCompact: {
    minHeight: 64,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  // Holds its place before the answer arrives but shows nothing: filled, an
  // empty slot is the loudest thing on the card and reads as a panel that
  // failed to load.
  answerBoxWaiting: {
    backgroundColor: 'transparent',
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
  // The area both answer controls share. Its height comes from the rating row,
  // which is always laid out, so it never changes between the two states.
  answerArea: {
    justifyContent: 'center',
  },
  answerHidden: {
    opacity: 0,
  },
  // Laid over the hidden pills rather than beside them, so the two states are
  // exactly the same height.
  actionFooter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
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
