import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSegments } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BetaFeedbackModal } from '@/src/components/feedback/BetaFeedbackModal';
import { BorderRadius, Colors, FontSize, LineHeight, Spacing } from '@/src/constants/theme';
import { useQuickAddStore } from '@/src/stores/quickAddStore';
import { useTutorialStore } from '@/src/stores/tutorialStore';

/**
 * Master switch for the whole beta feedback feature. Flip to false to turn it
 * off everywhere without touching anything else.
 *
 * When the beta ends, delete: this folder (src/components/feedback/),
 * src/services/betaFeedbackService.ts, the import + <BetaFeedbackButton /> in
 * app/_layout.tsx, and the public.beta_feedback table (migration 011).
 */
export const BETA_FEEDBACK_ENABLED = true;

// Route groups whose own top-right is taken, or where a floating button would
// sit on a native stack header: the lesson player's "koshur.org ↗" link, the
// sign-in/up screens, the game screens, and the launch/welcome flow.
const HIDDEN_SEGMENTS = new Set(['auth', 'game', 'lessons', 'welcome', '+not-found']);

const BUTTON_SIZE = 36;
const ICON_SIZE = 20;
// profile.tsx's avatar, which is that screen's heading.
const PROFILE_AVATAR_SIZE = 80;

/**
 * Distance from the safe-area inset to the top of the button, chosen so the
 * button centres on the first line of that tab's heading and reads as part of
 * its header row.
 *
 * Each tab builds its own header, so these numbers mirror the paddings in
 * app/(tabs)/*.tsx. A header that moves there has to move here too — the cost
 * of aligning to those titles from a single global mount.
 */
function titleLineOffset(tab: string | undefined, windowHeight: number): number {
  const centredOn = (paddingTop: number, lineHeight: number) =>
    paddingTop + (lineHeight - BUTTON_SIZE) / 2;

  switch (tab) {
    case 'flashcards':
      // flashcards.tsx shrinks its own header on short screens (< 820) and
      // drops a size off the title on shorter ones (< 760); the same
      // breakpoints have to apply here or the button drifts off the line.
      return centredOn(
        windowHeight < 820 ? Spacing.sm : Spacing.md,
        LineHeight.heading(windowHeight < 760 ? FontSize.xl : FontSize.xxl)
      );
    case 'play':
      // A centred hero title inside a padded ScrollView.
      return centredOn(Spacing.lg + Spacing.xl, LineHeight.heading(FontSize.title));
    case 'profile':
      // Profile leads with the avatar rather than a line of type.
      return centredOn(Spacing.lg + Spacing.lg, PROFILE_AVATAR_SIZE);
    default:
      // learn and lessons: a title at the top of a SafeAreaView header.
      return centredOn(Spacing.lg, LineHeight.heading(FontSize.xxl));
  }
}

/**
 * Temporary beta-test button, sitting on each screen's title line at the right
 * and mounted once in the root layout so it follows people across tabs. iOS
 * testers get told about TestFlight's screenshot feedback; everyone else gets a
 * box to type in.
 *
 * TEMPORARY (beta only): see BETA_FEEDBACK_ENABLED above.
 */
export function BetaFeedbackButton() {
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const quickAddOpen = useQuickAddStore((s) => s.isOpen);
  // Naani's own Skip control sits exactly here, and she docks at the top on two
  // screens, so the button stays away for the whole tour — not just the intro.
  const tourActive = useTutorialStore((s) => s.active);

  const root = segments[0];
  // Sheets and popouts are Modals, which react-native-web renders in-tree: the
  // button would otherwise float over their backdrops in the browser.
  const showButton =
    BETA_FEEDBACK_ENABLED &&
    !!root &&
    !HIDDEN_SEGMENTS.has(root) &&
    !tourActive &&
    !quickAddOpen &&
    !open;

  if (!BETA_FEEDBACK_ENABLED) return null;

  const top = insets.top + titleLineOffset(root === '(tabs)' ? segments[1] : undefined, height);

  return (
    <>
      {showButton ? (
        <Pressable
          style={({ pressed }) => [styles.button, { top }, pressed && styles.buttonPressed]}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Share feedback about the beta"
          hitSlop={8}
        >
          <SymbolView
            name={{ ios: 'exclamationmark.bubble.fill', android: 'feedback', web: 'feedback' }}
            tintColor="#fff"
            size={ICON_SIZE}
          />
        </Pressable>
      ) : null}
      {/* Kept mounted while the button hides, so a route or tour change can't
          take away words someone has already typed. */}
      <BetaFeedbackModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    // Same right gutter as the quick-add button and Naani's Skip.
    right: Spacing.lg,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  buttonPressed: {
    backgroundColor: Colors.walnut,
  },
});
