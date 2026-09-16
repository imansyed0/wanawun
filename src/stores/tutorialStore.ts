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
  // True while a native Modal (e.g. the Add sheet) covers the screen.
  // RN's Modal portals above everything else, including our docked
  // overlay, so the overlay hides itself and the screen that owns the
  // modal renders Naani's bubble inline instead.
  modalOpen: boolean;
  start: () => void;
  advanceIntro: () => void;
  next: () => void;
  /** Jump past the hands-on add-a-word steps. */
  skipAddWord: () => void;
  notify: (event: TutorialEvent, payload?: { wasCorrect?: boolean }) => void;
  skip: () => void;
  complete: () => void;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  active: false,
  step: 'intro',
  answers: 0,
  hadWrong: false,
  lastAnswer: null,
  modalOpen: false,

  start: () =>
    set({
      active: true,
      step: 'intro',
      answers: 0,
      hadWrong: false,
      lastAnswer: null,
      modalOpen: false,
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
      set({ step: 'flashcards', modalOpen: false });
      return;
    }
    const i = TOUR_STEPS.indexOf(step);
    set({ step: TOUR_STEPS[Math.min(i + 1, TOUR_STEPS.length - 1)] });
  },

  skipAddWord: () => {
    const { step } = get();
    if (step === 'glossary' || step === 'open-add' || step === 'add-word') {
      set({ step: 'flashcards', modalOpen: false });
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
        // They opened a lesson, so she can move on to Play.
        if (state.step === 'lessons') set({ step: 'play' });
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
