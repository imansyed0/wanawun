import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Grandmother } from '@/src/components/onboarding/Grandmother';
import { useTutorialStore } from '@/src/stores/tutorialStore';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';
import {
  GLOSSARY_PATH,
  FLASHCARDS_PATH,
  INTRO_LINES,
  getBubble,
  type Bubble,
} from '@/src/components/tutorial/tutorialCopy';

export function TutorialOverlay() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { active, step, lastAnswer, hadWrong, modalOpen, advanceIntro, notify, skip, complete } =
    useTutorialStore();

  const [introIndex, setIntroIndex] = useState(0);

  const onGlossary = pathname === GLOSSARY_PATH;
  const onFlashcards = pathname === FLASHCARDS_PATH;

  // Opening the Flashcards tab is itself a tour event.
  useEffect(() => {
    if (active && onFlashcards) notify('flashcardsOpened');
  }, [active, onFlashcards, notify]);

  useEffect(() => {
    if (step === 'intro') setIntroIndex(0);
  }, [step]);

  // A native Modal (e.g. the Add-word sheet) portals above this overlay
  // and would dim it along with the rest of the screen — the screen
  // that owns the modal renders Naani's bubble inline instead.
  if (!active || modalOpen) return null;

  const isIntro = step === 'intro';
  const bubble = isIntro
    ? ({ text: INTRO_LINES[introIndex], pose: 'wave' } as Bubble)
    : getBubble(step, onGlossary, onFlashcards, lastAnswer, hadWrong);

  const handleBubbleTap = () => {
    if (!isIntro) return;
    if (introIndex < INTRO_LINES.length - 1) {
      setIntroIndex((i) => i + 1);
    } else {
      advanceIntro();
    }
  };

  // The intro plays as a full-screen scene — Naani centre stage —
  // then melts away into the docked guide on the real app.
  if (isIntro) {
    return (
      <View style={styles.introRoot}>
        <Pressable style={styles.introStage} onPress={handleBubbleTap}>
          <View style={styles.introBubble}>
            <Animated.Text
              key={bubble.text}
              entering={FadeIn.duration(220)}
              style={styles.introBubbleText}
            >
              {bubble.text}
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
        >
          <Text style={styles.introSkipText}>Skip</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom: 62 + insets.bottom }]}
    >
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={styles.row}
        pointerEvents="box-none"
      >
        <View style={styles.granny} pointerEvents="none">
          <Grandmother pose={bubble.pose} size={92} />
        </View>

        <Pressable
          style={styles.bubble}
          onPress={handleBubbleTap}
          disabled={!isIntro}
        >
          <Animated.Text key={bubble.text} entering={FadeIn.duration(200)} style={styles.bubbleText}>
            {bubble.text}
          </Animated.Text>

          {isIntro ? (
            <Text style={styles.tapHint}>Tap to continue ▸</Text>
          ) : null}

          {step === 'wrap' ? (
            <Pressable style={styles.doneButton} onPress={complete}>
              <Text style={styles.doneButtonText}>Shukriya, Naani!</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.skip} onPress={skip} hitSlop={8}>
            <Text style={styles.skipText}>×</Text>
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
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
    fontSize: FontSize.lg,
    lineHeight: 28,
    color: Colors.text,
    textAlign: 'center',
    fontFamily: FontFamily.heading,
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
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: Spacing.sm,
    // Keep clear of the glossary's + FAB (56px wide, right: 24).
    paddingRight: 88,
    gap: 2,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  granny: {
    marginBottom: -6,
  },
  bubble: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingRight: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    gap: Spacing.xs,
  },
  bubbleText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Colors.text,
    fontFamily: FontFamily.bodySemi,
  },
  tapHint: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontFamily: FontFamily.bodySemi,
  },
  doneButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: FontSize.sm,
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
    lineHeight: 18,
  },
});
