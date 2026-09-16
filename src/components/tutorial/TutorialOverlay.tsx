import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
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
  getBubble,
  pathForStep,
  sectionForStep,
  type Bubble,
  type TourPath,
} from '@/src/components/tutorial/tutorialCopy';

export function TutorialOverlay() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { active, step, modalOpen, advanceIntro, next, skipAddWord, skip, complete } =
    useTutorialStore();

  const [introIndex, setIntroIndex] = useState(0);

  const onGlossary = pathname === GLOSSARY_PATH;
  const stepPath = pathForStep(step);

  // Each step takes the user to its tab. Only fires when the step
  // changes, so the user can still wander without being yanked back.
  useEffect(() => {
    if (!active || !stepPath) return;
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

  const bubble: Bubble = getBubble(step, onGlossary, false, null, false, !!user);
  // Wandered off the step's tab (e.g. tapped another tab mid-step).
  const offTrack = !!stepPath && pathname !== stepPath && step !== 'open-add';
  const section = sectionForStep(step);
  const highlightPath: TourPath | null = step === 'wrap' ? null : stepPath;
  // The Glossary's + FAB sits bottom-right; keep the bubble clear of it.
  const padRight = onGlossary ? 88 : Spacing.md;

  return (
    <>
      {highlightPath ? (
        <TabHighlight index={TAB_ORDER.indexOf(highlightPath)} bottom={insets.bottom} />
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.root, { bottom: TabBarContentHeight + insets.bottom }]}
      >
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.row, { paddingRight: padRight }]}
          pointerEvents="box-none"
        >
          <View style={styles.granny} pointerEvents="none">
            <Grandmother pose={bubble.pose} size={84} />
          </View>

          <View style={styles.bubble}>
            <Animated.Text key={bubble.text} entering={FadeIn.duration(200)} style={styles.bubbleText}>
              {bubble.text}
            </Animated.Text>

            <View style={styles.actions}>
              <Text style={styles.counter}>
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
    fontSize: FontSize.lg,
    lineHeight: LineHeight.heading(FontSize.lg),
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
    gap: Spacing.sm,
  },
  bubbleText: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.text,
    fontFamily: FontFamily.bodySemi,
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
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontFamily: FontFamily.bodySemi,
  },
  secondaryText: {
    fontSize: FontSize.sm,
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
    lineHeight: LineHeight.body(FontSize.md),
  },
  tabRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
});
