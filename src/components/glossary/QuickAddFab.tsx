import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Celebration } from '@/src/components/ui/Celebration';
import { Colors, FontFamily, LineHeight, Spacing, TabBarContentHeight } from '@/src/constants/theme';
import { useQuickAddStore } from '@/src/stores/quickAddStore';
import { useTutorialStore } from '@/src/stores/tutorialStore';

// Route groups where a floating button would get in the way: the launch
// redirect, sign-in/up modals, and the game screens (full-screen live
// matches, the lobby and the messenger's bottom composer).
const HIDDEN_SEGMENTS = new Set(['auth', 'game', '+not-found']);

// The one game screen that isn't a match or the lobby, so the button stays.
function isGameList(segments: string[]) {
  return segments[0] === 'game' && segments[1] === 'async' && segments[2] === 'list';
}

/**
 * Todoist-style always-present + button that opens the quick-add glossary
 * sheet. Mounted once in the root layout so it floats over tab screens and
 * lesson screens alike. It breathes a soft ring wherever it appears, so adding
 * a word never stops looking like something you can do; pressing play sets off
 * a brighter burst on top of that, as a reminder to add the words they hear.
 */
export function QuickAddFab() {
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const isSheetOpen = useQuickAddStore((s) => s.isOpen);
  const openSheet = useQuickAddStore((s) => s.open);
  const playNudge = useQuickAddStore((s) => s.playNudge);
  const celebration = useQuickAddStore((s) => s.celebration);
  const tutorialIntro = useTutorialStore((s) => s.active && s.step === 'intro');

  // The resting glow, looping for as long as the button is on screen. Only the
  // ring breathes: scaling the button itself without end would be exhausting to
  // sit next to, and it would fight the press state.
  const ambient = useRef(new Animated.Value(0)).current;
  // Held still instead of looping when the learner has asked for less motion,
  // so the ring is a quiet halo rather than nothing at all.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((on) => {
        if (cancelled) return;
        setReduceMotion(on);
        // Reduced motion holds the ring at a flat halo (see ambientStyle), so
        // there is nothing to drive.
        if (on) return;
        const loop = Animated.loop(
          Animated.timing(ambient, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.quad),
            // react-native-web never advances a looped native-driven timing, so
            // the ring would sit frozen at its first frame in the browser.
            useNativeDriver: Platform.OS !== 'web',
          })
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      ambient.stopAnimation();
    };
  }, [ambient]);

  // Glow: a ring that swells out from the button and fades, plus a small bump.
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (playNudge === 0) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        glow.stopAnimation();
        glow.setValue(0);
        Animated.sequence(
          Array.from({ length: reduceMotion ? 1 : 3 }, () =>
            Animated.timing(glow, {
              toValue: 1,
              duration: 1000,
              easing: Easing.out(Easing.quad),
              // Same web caveat as the resting ring above.
              useNativeDriver: Platform.OS !== 'web',
            })
          ).flatMap((pulse) => [
            pulse,
            Animated.timing(glow, {
              toValue: 0,
              duration: 0,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ])
        ).start();
      });
    return () => {
      cancelled = true;
    };
  }, [playNudge, glow]);

  const root = segments[0];
  const hiddenHere = HIDDEN_SEGMENTS.has(root) && !isGameList(segments);
  if (!root || hiddenHere || tutorialIntro || isSheetOpen) {
    return null;
  }

  // Inside the tab navigator the button has to clear the tab bar; on stack
  // screens (e.g. the lesson player) it only has to clear the home indicator.
  const onTabs = root === '(tabs)';
  const bottom =
    (onTabs ? TabBarContentHeight : 0) + insets.bottom + (onTabs ? Spacing.md : Spacing.lg);

  const handlePress = () => {
    openSheet();
    useTutorialStore.getState().notify('addModalOpened');
  };

  // Dimmer and tighter than the play burst below, so the two never read as the
  // same signal: this one is the button's resting state, that one is a prompt.
  const ambientStyle = {
    opacity: ambient.interpolate({
      inputRange: [0, 0.35, 0.7, 1],
      outputRange: reduceMotion ? [0.2, 0.2, 0.2, 0.2] : [0.1, 0.3, 0.16, 0.1],
    }),
    transform: [
      {
        scale: ambient.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: reduceMotion ? [1.3, 1.3, 1.3] : [1.08, 1.42, 1.08],
        }),
      },
    ],
  };
  const ringStyle = {
    opacity: glow.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  };
  const bumpStyle = {
    transform: [{ scale: glow.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.12, 1] }) }],
  };

  return (
    <>
      {/* Confetti for a word just added. It sits behind the button, and is as
          wide as twice the gap from the screen's right edge to the middle of
          the button, so pinning it right centres it on the button — and no
          piece flies off the side of the screen. */}
      <Celebration
        id="glossary-fab"
        trigger={celebration}
        width={(Spacing.lg + 28) * 2}
        style={{ right: 0, bottom: bottom + 40 }}
      />
      <Animated.View style={[styles.wrap, { bottom }, bumpStyle]} pointerEvents="box-none">
        <Animated.View style={[styles.ring, ambientStyle]} pointerEvents="none" />
        <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="Add a word to your glossary"
          hitSlop={6}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: Spacing.lg,
    width: 56,
    height: 56,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: Colors.primary,
  },
  fab: {
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
  fabPressed: {
    backgroundColor: Colors.primaryDark,
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
    lineHeight: LineHeight.body(30),
    fontFamily: FontFamily.bodySemi,
  },
});
