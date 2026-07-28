import { create } from 'zustand';
import { markOnboardingSeen } from '@/src/services/onboardingService';

/**
 * Naani's guided tour of the core loop: add a word to your glossary,
 * then drill it in Flashcards. Runs as an overlay on the real app —
 * real screens report events here and the tour advances.
 */
export type TutorialStep =
  | 'intro' // Naani introduces herself (multi-line, tap to advance)
  | 'open-add' // waiting for the user to tap the + on the Glossary tab
  | 'add-word' // add modal is open, waiting for a word to be added
  | 'word-added' // celebrate; waiting for the user to open the Flashcards tab
  | 'practice' // doing real flashcard reps
  | 'wrap'; // final message + done button

export type TutorialEvent =
  | 'addModalOpened'
  | 'addModalClosed'
  | 'wordAdded'
  | 'flashcardsOpened'
  | 'flashcardAnswered';

const MIN_ANSWERS = 2;
const MAX_ANSWERS = 4;

interface TutorialState {
  active: boolean;
  step: TutorialStep;
  answers: number;
  hadWrong: boolean;
  lastAnswer: 'right' | 'wrong' | null;
  // True while a native Modal (e.g. the Add-word sheet) covers the
  // screen — RN's Modal portals above everything else, including our
  // docked overlay, so the overlay hides itself and the screen that
  // owns the modal renders Naani's bubble inline instead.
  modalOpen: boolean;
  start: () => void;
  advanceIntro: () => void;
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
    if (get().step === 'intro') set({ step: 'open-add' });
  },

  notify: (event, payload) => {
    const state = get();
    if (!state.active) return;

    switch (event) {
      case 'addModalOpened':
        set({
          modalOpen: true,
          step: state.step === 'open-add' || state.step === 'intro' ? 'add-word' : state.step,
        });
        break;
      case 'addModalClosed':
        set({
          modalOpen: false,
          step: state.step === 'add-word' ? 'open-add' : state.step,
        });
        break;
      case 'wordAdded':
        // The Learn screen closes its own modal right before this fires.
        set({
          modalOpen: false,
          step:
            state.step === 'add-word' || state.step === 'open-add' || state.step === 'intro'
              ? 'word-added'
              : state.step,
        });
        break;
      case 'flashcardsOpened':
        if (state.step === 'word-added') set({ step: 'practice' });
        break;
      case 'flashcardAnswered': {
        if (state.step !== 'practice') break;
        const wasCorrect = payload?.wasCorrect ?? false;
        const answers = state.answers + 1;
        const hadWrong = state.hadWrong || !wasCorrect;
        const finished =
          (answers >= MIN_ANSWERS && wasCorrect) || answers >= MAX_ANSWERS;
        set({
          answers,
          hadWrong,
          lastAnswer: wasCorrect ? 'right' : 'wrong',
          step: finished ? 'wrap' : 'practice',
        });
        break;
      }
    }
  },

  skip: () => {
    set({ active: false });
    markOnboardingSeen().catch(() => {});
  },

  complete: () => {
    set({ active: false });
    markOnboardingSeen().catch(() => {});
  },
}));
