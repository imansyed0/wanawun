import type { GrandmotherPose } from '@/src/components/onboarding/Grandmother';
import type { TutorialStep } from '@/src/stores/tutorialStore';

// Full-screen hello before the tour moves onto the real app.
export const INTRO_LINES = [
  'Salaam, jaanu. I’m Naani. Sit with me a minute.',
  'Wanwun is for learning Koshur the way your own family speaks it, not the way a textbook does.',
  'Let me walk you round the app. It’s quick, and you can send me away any time with Skip.',
];

export const GLOSSARY_PATH = '/learn';
export const FLASHCARDS_PATH = '/flashcards';

export type TourPath = '/learn' | '/flashcards' | '/lessons' | '/play' | '/profile';

/**
 * Tab order as laid out in app/(tabs)/_layout.tsx. Used to place the
 * highlight ring over the right tab. Keep in sync with the layout.
 */
export const TAB_ORDER: TourPath[] = ['/learn', '/lessons', '/play', '/flashcards', '/profile'];

/** Which tab each step lives on (null = no tab, e.g. the intro). */
export function pathForStep(step: TutorialStep): TourPath | null {
  switch (step) {
    case 'glossary':
    case 'open-add':
    case 'add-word':
    case 'word-added':
    case 'word-options':
      return '/learn';
    case 'flashcards':
      return '/flashcards';
    case 'lessons':
      return '/lessons';
    case 'play':
      return '/play';
    case 'profile':
    case 'wrap':
      return '/profile';
    default:
      return null;
  }
}

/** "n of TOUR_SECTIONS" shown in the bubble. */
export const TOUR_SECTIONS = 6;
export function sectionForStep(step: TutorialStep): number {
  switch (step) {
    case 'glossary':
    case 'open-add':
    case 'add-word':
    case 'word-added':
    case 'word-options':
      return 1;
    case 'flashcards':
      return 2;
    case 'lessons':
      return 3;
    case 'play':
      return 4;
    case 'profile':
      return 5;
    case 'wrap':
      return 6;
    default:
      return 0;
  }
}

/**
 * The word Naani has the learner add. It's in S. Hassan's dictionary with a
 * recording (DSAL 00325), so they can hear it before they save it.
 */
export const TOUR_WORD = {
  kashmiri: 'asun',
  /** What the learner types into the English box. */
  english: 'smile',
  /** Shown on the chip, so they know what they're hearing. */
  gloss: 'smile/laugh',
  audioId: '00325',
};

export type Bubble = {
  text: string;
  pose: GrandmotherPose;
  /** Rendered as a tappable word that plays its dictionary recording. */
  word?: { kashmiri: string; english: string; gloss: string; audioId: string };
};

export function getBubble(
  step: TutorialStep,
  onGlossary: boolean,
  _onFlashcards?: boolean,
  _lastAnswer?: 'right' | 'wrong' | null,
  _hadWrong?: boolean,
  signedIn: boolean = false,
  insideLesson: boolean = false,
  /** Words in the glossary; null while the Glossary screen is still counting. */
  glossaryCount: number | null = null
): Bubble {
  switch (step) {
    case 'glossary':
      return {
        // Everyone who answers Naani's level question is seeded a few starter
        // words, so she says so, unless the glossary has come back empty.
        text:
          glossaryCount === 0
            ? 'This is your Glossary, your own little dictionary. Whatever you hear at dinner and don’t know goes in here.'
            : 'This is your Glossary, your own little dictionary. I’ve tucked a few words in already to give you a head start, picked for the level you told me. Whatever you hear at dinner and don’t know goes in here too.',
        pose: 'kangri',
      };
    case 'open-add':
      if (!onGlossary) {
        return { text: 'Go back to the Glossary tab first, jaanu.', pose: 'point' };
      }
      return {
        // {plus} renders as a pill that looks like the app's + button. Naming it
        // as the round button in the bottom corner matters: learners were
        // hunting for an "Add" link in the list instead of the floating one.
        text: 'Let’s add one together. Tap asun below to hear it, then tap the round {plus} button in the bottom corner and add it yourself.',
        pose: 'point',
        word: TOUR_WORD,
      };
    case 'add-word':
      return {
        text: 'Write asun and smile in the boxes. Tap the red dot to record yourself, then Add.',
        pose: 'kangri',
      };
    case 'word-added':
      return {
        text: 'Shabash, it’s saved. Next time you’re with family, tap the red dot and let them say it — their voice stays with you.',
        pose: 'cheer',
      };
    case 'word-options':
      if (!onGlossary) {
        return { text: 'Go back to the Glossary tab first, jaanu.', pose: 'point' };
      }
      return {
        // The re-record and delete buttons used to sit on every row. They live
        // behind the row itself now, which is tidier but invisible until
        // somebody tells you, so Naani tells you.
        text: 'Tap any word in the list to see what else you can do with it — re-record if you’re not happy with your pronunciation, or throw it out if you don’t want it.',
        pose: 'point',
      };
    case 'flashcards':
      return {
        text: 'Flashcards quiz you on your own words. Try this one — reveal it, then tell me honestly if you knew it.',
        pose: 'kangri',
      };
    case 'lessons':
      return {
        text: insideLesson
          ? 'Here you are. Play a clip and listen, then add one word from it — that’s what earns the ✓. Tap Next when you’re ready.'
          : 'Proper audio courses. Open one and pick a lesson — listen, and keep a word from each one.',
        pose: 'point',
      };
    case 'play':
      return {
        text: signedIn
          ? 'Koshur Clash is a quick word race against a cousin or friend. Fastest one wins.'
          : 'Koshur Clash is a quick word race against a cousin or friend. Sign in for this one.',
        pose: 'cheer',
      };
    case 'profile':
      return {
        text: signedIn
          ? 'Your Profile keeps count of your progress. Want to see me again? Tap Replay Naani’s tour.'
          : 'Sign in here so your words are safe on every phone — and so you can play.',
        pose: 'point',
      };
    case 'wrap':
      return {
        text: 'That’s all of it, jaanu. Add words as you hear them, and come see me again pagah — tomorrow.',
        pose: 'wave',
      };
    default:
      return { text: '', pose: 'wave' };
  }
}
