---
name: naani-tour
description: Change or test Naani's guided tour in Wanwun — the onboarding overlay, its steps, copy, hands-on steps and bubble placement. Use when editing tutorial copy, adding or reordering tour steps, fixing the tour bubble covering something, or walking the tour to verify it.
---

# Naani's tour

The first-launch tour: Naani (a Kashmiri grandmother) walks the learner through
all five tabs. It is an overlay rendered over the real app, not a separate screen,
and it is driven by a small zustand store.

Paths are relative to the repo root.

## The three files

| File | Holds |
|---|---|
| `src/stores/tutorialStore.ts` | `TutorialStep` order, events, `next`/`skip`/`complete`, the state the app reports into |
| `src/components/tutorial/tutorialCopy.ts` | Every line Naani says, `TOUR_WORD`, and which tab each step belongs to |
| `src/components/tutorial/TutorialOverlay.tsx` | Rendering: bubble, position, the word chip, the tab highlight ring |

The overlay is mounted **in the root layout** (`app/_layout.tsx`), not in the tabs
layout, so Naani stays on screen when a step sends the learner into a lesson.

## Step order

`intro → glossary → open-add → add-word → word-added → flashcards → lessons → play → profile → wrap`

The learner sees six numbered sections (`TOUR_SECTIONS`); the add-word steps share
one number.

## Hands-on steps

Two steps wait for the learner to actually do something. Screens report in through
`useTutorialStore.getState().notify(event)`:

| Event | Fired by | Effect |
|---|---|---|
| `addModalOpened` / `addModalClosed` | the quick-add sheet | moves between `open-add` and `add-word` |
| `wordAdded` | the quick-add sheet | → `word-added` |
| `flashcardAnswered` | `app/(tabs)/flashcards.tsx` when a card is graded | `flashcards` → `lessons` |
| `lessonOpened` | `app/lessons/[courseId]/[lessonId].tsx` on mount | sets `insideLesson`, which changes Naani's line; the step advances on Next, not automatically |

Every hands-on step keeps an escape (`Next`, or `Maybe later` on the add step) so
the tour can never trap someone.

## Bubble placement

This is where most of the bugs have been. The bubble docks to the bottom by
default, above the tab bar, and:

- **Naani stands under the bubble, not beside it** (`styles.stack`). Beside it she
  ate 110px, and the 88px gutter that used to clear the floating + button ate
  another 88, leaving the bubble ~180px wide on a phone: every line wrapped after
  three words and the bubble grew tall enough to cover the whole screen. Stacked,
  the bubble gets the full width and her 104px strip is what clears the + button
  (56px, `Spacing.md` above the tab bar), so no horizontal gutter is needed.
- **Flashcards docks to the top** (`dockTop`). The card fills the middle of that
  screen and its buttons sit at the bottom, so a bottom-docked bubble covers either
  the word or "Reveal answer" — nudging it up the same column just swaps which.
  It starts `SCREEN_TITLE_HEIGHT` (96) below the inset so the screen's own title
  stays readable.
- **On non-tab screens** (a lesson player) there is no tab bar, so the bottom
  offset drops to `Spacing.md` and the tab highlight ring is hidden.
- **The step counter** is `flexShrink: 0` + `numberOfLines={1}`; without that a wide
  button beside it breaks "6 of 6" across three lines.

## Walking the tour to verify a change

Use the `run-wanawun` driver. Start from Profile, because that's where Replay is:

```bash
node .claude/skills/run-wanawun/driver.mjs goto /profile tap "Replay Naani" shot intro.png
node .claude/skills/run-wanawun/driver.mjs tap "Tap to continue" shot intro2.png
```

The intro has three lines and advances one per tap. Then `Next ▸` moves through
steps, `Maybe later` skips the add steps.

To check a bubble doesn't cover something, measure rather than eyeball:

```bash
node .claude/skills/run-wanawun/driver.mjs eval "
  (() => {
    const box = (needle) => [...document.querySelectorAll('div')]
      .filter(e => e.childElementCount === 0 && e.textContent.trim().includes(needle))
      .map(e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })[0];
    return { bubbleFooter: box('of 6'), target: box('Reveal answer') };
  })()
"
```

## Gotchas

- **The tour is in-memory.** A page reload ends it; there is no persistence. Replay
  from Profile each time.
- **`hasSeenOnboarding`** (AsyncStorage, via `onboardingService`) decides whether the
  tour runs on first launch. `skip` and `complete` both set it.
- **Clicking by coordinates is dangerous.** The overlay sits over real UI, so a
  mis-aimed click hits whatever is underneath — during development this deleted a
  word from the glossary. Use the driver's `tap`, which resolves a label first.
- **The intro is a full-screen `Pressable`**; synthetic clicks don't advance it.
- **`{plus}` in copy** renders as a green pill that mimics the + button. It is
  substituted in `TutorialOverlay`, not by the copy file.
- **The tour word** (`TOUR_WORD` in `tutorialCopy.ts`) must exist in the Hassan
  dictionary with a clip if its chip is to play audio — currently `asun`
  (smile/laugh, DSAL id `00325`). See the `dictionary-audio` skill.
