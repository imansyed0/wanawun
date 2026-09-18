import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Grandmother } from '@/src/components/onboarding/Grandmother';
import { useTutorialStore } from '@/src/stores/tutorialStore';
import { useAuth } from '@/src/hooks/useAuth';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  LineHeight,
  Spacing,
  TabBarContentHeight,
} from '@/src/constants/theme';
import {
  GLOSSARY_PATH,
  INTRO_LINES,
  TAB_ORDER,
  TOUR_SECTIONS,
  TOUR_WORD,
  getBubble,
  pathForStep,
  sectionForStep,
  type Bubble,
  type TourPath,
} from '@/src/components/tutorial/tutorialCopy';
import { dictionaryAudioUrls } from '@/src/lib/englishDictionary';
import { playAudio, stopAudio } from '@/src/services/audioService';
import { startTourMusic, stopTourMusic } from '@/src/services/tourMusic';

/** Naani's copy writes the app's + button as {plus}; see tutorialCopy. */
const PLUS_TOKEN = '{plus}';

/**
 * How tall Naani stands under her bubble. She sits in the strip between the
 * bubble and the tab bar, and that strip also has to be taller than the
 * floating + button (56px, Spacing.md above the tab bar) so the bubble never
 * lands on top of it.
 */
const GRANNY_SIZE = 104;

/**
 * Height of a screen's title block (title + one line of subtitle). The only
 * top-docked step is Flashcards, and starting her right under the title keeps
 * "Flashcards / Spaced repetition…" readable instead of hiding the screen she
 * is naming.
 */
const SCREEN_TITLE_HEIGHT = 96;

/** Her line, with {plus} drawn as a small green + like the floating button. */
function bubbleContent(text: string) {
  const pieces = text.split(PLUS_TOKEN);
  return pieces.flatMap((piece, i) =>
    i === 0
      ? [piece]
      : [
          <Text key={`plus-${i}`} style={styles.inlinePlus}>
            {' + '}
          </Text>,
          piece,
        ]
  );
}

export function TutorialOverlay() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { active, step, modalOpen, insideLesson, advanceIntro, next, skipAddWord, skip, complete } =
    useTutorialStore();

  const [introIndex, setIntroIndex] = useState(0);

  // Quiet music for as long as the tour is running. Stops on Skip, on the last
  // step, and if this overlay goes away with the tour still open.
  useEffect(() => {
    if (!active) {
      stopTourMusic();
      return;
    }
    void startTourMusic();
    return stopTourMusic;
  }, [active]);

  // Naani's suggested word: tapping it plays the dictionary's recording, so the
  // learner hears it before adding it themselves.
  const [wordPlaying, setWordPlaying] = useState(false);

  async function playTourWord() {
    if (wordPlaying) {
      await stopAudio();
      setWordPlaying(false);
      return;
    }
    const [url] = dictionaryAudioUrls(TOUR_WORD.audioId);
    if (!url) return;
    setWordPlaying(true);
    try {
      await playAudio(url, { onFinish: () => setWordPlaying(false), tag: 'tourWord' });
    } catch (error) {
      console.warn('Tour word playback failed:', error);
      setWordPlaying(false);
    }
  }

  const segments = useSegments() as string[];
  const onGlossary = pathname === GLOSSARY_PATH;
  const stepPath = pathForStep(step);
  // A course list or lesson player counts as being on the Lessons step.
  const insideLessons = step === 'lessons' && pathname.startsWith('/lessons');
  // Only tab screens have a tab bar to sit above; lesson screens don't.
  const onTabs = segments[0] === '(tabs)';

  // Each step takes the user to its tab. Only fires when the step
  // changes, so the user can still wander without being yanked back.
  useEffect(() => {
    if (!active || !stepPath) return;
    // The Lessons step asks them to open a lesson, so don't drag them back out.
    if (step === 'lessons' && pathname.startsWith('/lessons')) return;
    if (pathname !== stepPath) router.navigate(stepPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  useEffect(() => {
    if (step === 'intro') setIntroIndex(0);
  }, [step, active]);

  // A native Modal (e.g. the Add sheet) portals above this overlay and
  // would dim it with the rest of the screen, so the screen that owns
  // the modal renders Naani's bubble inline instead.
  if (!active || modalOpen) return null;

  const isIntro = step === 'intro';

  const handleIntroTap = () => {
    if (introIndex < INTRO_LINES.length - 1) {
      setIntroIndex((i) => i + 1);
    } else {
      advanceIntro();
    }
  };

  // The intro plays as a full-screen scene with Naani centre stage,
  // then gives way to the docked guide on the real app.
  if (isIntro) {
    const text = INTRO_LINES[introIndex];
    return (
      <View style={styles.introRoot}>
        <Pressable style={styles.introStage} onPress={handleIntroTap}>
          <View style={styles.introBubble}>
            <Animated.Text key={text} entering={FadeIn.duration(220)} style={styles.introBubbleText}>
              {text}
            </Animated.Text>
            <Text style={styles.introTapHint}>Tap to continue ▸</Text>
          </View>
          <View style={styles.introBubbleTail} />
          <Grandmother pose="wave" size={200} />
        </Pressable>
        <Pressable
          style={[styles.introSkip, { top: insets.top + Spacing.md }]}
          onPress={skip}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip Naani's tour"
        >
          <Text style={styles.introSkipText}>Skip</Text>
        </Pressable>
      </View>
    );
  }

  const bubble: Bubble = getBubble(step, onGlossary, false, null, false, !!user, insideLesson);
  // Wandered off the step's tab (e.g. tapped another tab mid-step).
  const offTrack =
    !!stepPath && pathname !== stepPath && step !== 'open-add' && !insideLessons;
  const section = sectionForStep(step);
  // The ring points at a tab, so it only makes sense on the tab screens.
  const highlightPath: TourPath | null = step === 'wrap' || !onTabs ? null : stepPath;
  // The card fills the middle of the Flashcards screen and its buttons sit at
  // the bottom, so there's no room for her down there: dock her at the top for
  // that step, leaving the word and the rating pills clear.
  const dockTop = step === 'flashcards';

  return (
    <>
      {highlightPath ? (
        <TabHighlight index={TAB_ORDER.indexOf(highlightPath)} bottom={insets.bottom} />
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.root,
          dockTop
            ? { top: insets.top + SCREEN_TITLE_HEIGHT }
            : { bottom: (onTabs ? TabBarContentHeight : Spacing.md) + insets.bottom },
        ]}
      >
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={styles.stack}
          pointerEvents="box-none"
        >
          <View style={styles.bubble}>
            <Animated.Text key={bubble.text} entering={FadeIn.duration(200)} style={styles.bubbleText}>
              {bubbleContent(bubble.text)}
            </Animated.Text>

            {bubble.word ? (
              <Pressable
                style={styles.wordChip}
                onPress={playTourWord}
                accessibilityRole="button"
                accessibilityLabel={`Hear ${bubble.word.kashmiri}, which means ${bubble.word.gloss}`}
              >
                <Text style={styles.wordChipIcon}>{wordPlaying ? '■' : '▶'}</Text>
                <Text style={styles.wordChipWord}>{bubble.word.kashmiri}</Text>
                <Text style={styles.wordChipGloss}>{bubble.word.gloss}</Text>
              </Pressable>
            ) : null}

            <View style={styles.actions}>
              <Text style={styles.counter} numberOfLines={1}>
                {section} of {TOUR_SECTIONS}
              </Text>
              <View style={styles.actionButtons}>
                {step === 'open-add' ? (
                  <Pressable onPress={skipAddWord} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.secondaryText}>Maybe later</Text>
                  </Pressable>
                ) : null}

                {step === 'wrap' ? (
                  <Pressable style={styles.primaryButton} onPress={complete} accessibilityRole="button">
                    <Text style={styles.primaryButtonText}>Shukriya, Naani</Text>
                  </Pressable>
                ) : step === 'open-add' ? null : offTrack ? (
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => stepPath && router.navigate(stepPath)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryButtonText}>Take me back</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.primaryButton} onPress={next} accessibilityRole="button">
                    <Text style={styles.primaryButtonText}>Next ▸</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Pressable
              style={styles.skip}
              onPress={skip}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="End Naani's tour"
            >
              <Text style={styles.skipText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.granny} pointerEvents="none">
            <Grandmother pose={bubble.pose} size={GRANNY_SIZE} />
          </View>
        </Animated.View>
      </View>
    </>
  );
}

/** Pulsing ring drawn over one tab in the tab bar. */
function TabHighlight({ index, bottom }: { index: number; bottom: number }) {
  const { width } = useWindowDimensions();
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (index < 0) return null;
  const tabWidth = width / TAB_ORDER.length;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tabRing,
        {
          bottom: bottom + 2,
          left: index * tabWidth + 4,
          width: tabWidth - 8,
          height: TabBarContentHeight - 4,
        },
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  introRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  introStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  introBubble: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    maxWidth: 520,
    minHeight: 96,
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  introBubbleText: {
    // Same face and size as the in-app tour bubble below: Rozha One is a
    // display serif and was hard to read at paragraph length.
    fontSize: FontSize.lg,
    lineHeight: LineHeight.body(FontSize.lg),
    color: Colors.text,
    textAlign: 'center',
    fontFamily: FontFamily.bodySemi,
  },
  introTapHint: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    fontFamily: FontFamily.bodySemi,
    textAlign: 'center',
  },
  introBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.surface,
    marginTop: -1,
    marginBottom: Spacing.md,
  },
  introSkip: {
    position: 'absolute',
    right: Spacing.lg,
  },
  introSkipText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bodySemi,
  },
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'stretch',
  },
  // Bubble on top at full width, Naani under its bottom-left corner. Standing
  // her beside it instead left the bubble about 180px wide on a phone, which
  // wrapped every line after three words and made the bubble tall enough to
  // cover the screen behind it.
  stack: {
    paddingHorizontal: Spacing.sm,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  granny: {
    alignSelf: 'flex-start',
    marginLeft: Spacing.xs,
  },
  bubble: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    // Squared-off bottom-left corner: the tail, pointing down at Naani.
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingRight: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    gap: Spacing.sm,
  },
  bubbleText: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.body(FontSize.lg),
    color: Colors.text,
    fontFamily: FontFamily.bodySemi,
  },
  // Matches the floating + button: white on the app's green, rounded.
  inlinePlus: {
    color: '#fff',
    backgroundColor: Colors.primary,
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wordChipWord: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.body(FontSize.lg),
    fontFamily: FontFamily.bodySemi,
    color: Colors.primaryDark,
  },
  wordChipIcon: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
  },
  wordChipGloss: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  counter: {
    fontSize: FontSize.sm,
    // Never wrap: a wide button next to it was breaking "6 of 6" over three lines.
    flexShrink: 0,
    color: Colors.textLight,
    fontFamily: FontFamily.bodySemi,
  },
  secondaryText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bodySemi,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodyBold,
  },
  skip: {
    position: 'absolute',
    top: 6,
    right: 8,
  },
  skipText: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    lineHeight: LineHeight.body(FontSize.md),
  },
  tabRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
});
