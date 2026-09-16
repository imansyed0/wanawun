import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
 * lesson screens alike. It glows briefly whenever someone presses play, as a
 * reminder to add the words they hear.
 */
export function QuickAddFab() {
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const isSheetOpen = useQuickAddStore((s) => s.isOpen);
  const openSheet = useQuickAddStore((s) => s.open);
  const playNudge = useQuickAddStore((s) => s.playNudge);
  const tutorialIntro = useTutorialStore((s) => s.active && s.step === 'intro');

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
              useNativeDriver: true,
            })
          ).flatMap((pulse) => [pulse, Animated.timing(glow, { toValue: 0, duration: 0, useNativeDriver: true })])
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

  const ringStyle = {
    opacity: glow.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  };
  const bumpStyle = {
    transform: [{ scale: glow.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.12, 1] }) }],
  };

  return (
    <Animated.View style={[styles.wrap, { bottom }, bumpStyle]} pointerEvents="box-none">
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
