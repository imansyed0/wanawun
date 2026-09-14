import { Pressable, StyleSheet, Text } from 'react-native';
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
 * lesson screens alike.
 */
export function QuickAddFab() {
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const isSheetOpen = useQuickAddStore((s) => s.isOpen);
  const openSheet = useQuickAddStore((s) => s.open);
  const tutorialIntro = useTutorialStore((s) => s.active && s.step === 'intro');

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

  return (
    <Pressable
      style={({ pressed }) => [styles.fab, { bottom }, pressed && styles.fabPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Add a word to your glossary"
      hitSlop={6}
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.lg,
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
