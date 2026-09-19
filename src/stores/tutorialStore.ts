import { create } from 'zustand';
import { markOnboardingSeen } from '@/src/services/onboardingService';

/**
 * Naani's guided tour of the whole app. Runs as an overlay on the real
 * tabs: each step navigates to its tab, highlights it, and shows a
 * bubble with Next / Skip. Only the Glossary part is hands-on (adding a
 * word), and even that can be skipped so the tour never soft-locks.
 */
export type TutorialStep =
  | 'intro' // full-screen hello (multi-line, tap to advance)
  | 'glossary' // what the Glossary is for
  | 'open-add' // invite the user to tap + (or skip this bit)
  | 'add-word' // add modal open, waiting for a word/phrase to be added
  | 'word-added' // saved; explain recording relatives' audio
  | 'word-options' // tapping a word opens its re-record / delete choices
  | 'flashcards'
  | 'lessons'
  | 'play'
  | 'profile'
  | 'wrap'; // final message + done button

export type TutorialEvent =
  | 'addModalOpened'
  | 'addModalClosed'
  | 'wordAdded'
  | 'flashcardsOpened'
  /** A card was revealed and rated: the hands-on part of the Flashcards step. */
  | 'flashcardAnswered'
  /** A lesson player was opened: the hands-on part of the Lessons step. */
  | 'lessonOpened';

/** Order used by next(). */
export const TOUR_STEPS: TutorialStep[] = [
  'intro',
  'glossary',
  'open-add',
  'add-word',
  'word-added',
  'word-options',
  'flashcards',
  'lessons',
  'play',
  'profile',
  'wrap',
];

interface TutorialState {
  active: boolean;
  step: TutorialStep;
  // Kept for compatibility with screens that read them.
  answers: number;
  hadWrong: boolean;
  lastAnswer: 'right' | 'wrong' | null;
  /** True once they've opened a lesson during the Lessons step, so Naani can
   *  say something useful in there instead of repeating herself. */
  insideLesson: boolean;
  // True while a native Modal (e.g. the Add sheet) covers the screen.
  // RN's Modal portals above everything else, including our docked
  // overlay, so the overlay hides itself and the screen that owns the
  // modal renders Naani's bubble inline instead.
  modalOpen: boolean;
  /** How many words are in the glossary, reported by the Glossary screen as it
   *  loads; null until it has. Naani mentions the starter words she put in,
   *  so she needs to know they're actually there before she takes credit. */
  glossaryCount: number | null;
  setGlossaryCount: (count: number) => void;
  start: () => void;
  advanceIntro: () => void;
  next: () => void;
  /** Jump past the hands-on add-a-word steps. */
  skipAddWord: () => void;
  notify: (event: TutorialEvent, payload?: { wasCorrect?: boolean }) => void;
  skip: () => void;
  complete: () => void;
}

/**
 * Where the glossary part hands over. Skipping the hands-on add still leaves the
 * row choices worth explaining, so that step is not part of what gets skipped —
 * unless the glossary is empty, when there is no row to tap and Naani would be
 * pointing at nothing.
 */
function afterAddWord(glossaryCount: number | null): TutorialStep {
  return glossaryCount === 0 ? 'flashcards' : 'word-options';
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  active: false,
  step: 'intro',
  answers: 0,
  hadWrong: false,
  lastAnswer: null,
  modalOpen: false,
  insideLesson: false,
  glossaryCount: null,

  setGlossaryCount: (glossaryCount) => set({ glossaryCount }),

  start: () =>
    set({
      active: true,
      step: 'intro',
      answers: 0,
      hadWrong: false,
      lastAnswer: null,
      modalOpen: false,
      insideLesson: false,
    }),

  advanceIntro: () => {
    if (get().step === 'intro') set({ step: 'glossary' });
  },

  next: () => {
    const { step, active } = get();
    if (!active) return;
    if (step === 'wrap') {
      get().complete();
      return;
    }
    // 'open-add' → Next skips the modal step (it only advances on a real add).
    if (step === 'open-add' || step === 'add-word') {
      set({ step: afterAddWord(get().glossaryCount), modalOpen: false });
      return;
    }
    const i = TOUR_STEPS.indexOf(step);
    set({ step: TOUR_STEPS[Math.min(i + 1, TOUR_STEPS.length - 1)], insideLesson: false });
  },

  skipAddWord: () => {
    const { step, glossaryCount } = get();
    if (step === 'glossary' || step === 'open-add' || step === 'add-word') {
      set({ step: afterAddWord(glossaryCount), modalOpen: false });
    }
  },

  notify: (event) => {
    const state = get();
    if (!state.active) return;
    const inGlossaryPart =
      state.step === 'glossary' || state.step === 'open-add' || state.step === 'add-word';

    switch (event) {
      case 'addModalOpened':
        set({
          modalOpen: true,
          step: state.step === 'glossary' || state.step === 'open-add' ? 'add-word' : state.step,
        });
        break;
      case 'addModalClosed':
        set({
          modalOpen: false,
          step: state.step === 'add-word' ? 'open-add' : state.step,
        });
        break;
      case 'wordAdded':
        // The Glossary screen closes its own modal right before this fires.
        set({ modalOpen: false, step: inGlossaryPart ? 'word-added' : state.step });
        break;
      case 'flashcardAnswered':
        // Answered one card, as Naani asked — move her on to Lessons.
        if (state.step === 'flashcards') set({ step: 'lessons' });
        break;
      case 'lessonOpened':
        // Naani follows them in and changes what she says. The step moves on
        // when they tap Next, not the moment the player opens.
        if (state.step === 'lessons') set({ insideLesson: true });
        break;
      case 'flashcardsOpened':
        break;
    }
  },

  skip: () => {
    set({ active: false, modalOpen: false });
    markOnboardingSeen().catch(() => {});
  },

  complete: () => {
    set({ active: false, modalOpen: false });
    markOnboardingSeen().catch(() => {});
  },
}));
