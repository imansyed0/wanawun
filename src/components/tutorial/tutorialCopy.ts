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
  signedIn: boolean = false
): Bubble {
  switch (step) {
    case 'glossary':
      return {
        text: 'This is your Glossary, your own little dictionary. When an aunty says something at dinner and you don’t know it, it goes in here.',
        pose: 'kangri',
      };
    case 'open-add':
      if (!onGlossary) {
        return { text: 'Go back to the Glossary tab first, jaanu.', pose: 'point' };
      }
      return {
        // {plus} renders as a pill that looks like the app's + button.
        text: 'Let’s add one together. Tap asun below to hear it, then tap the {plus} and add it yourself.',
        pose: 'point',
        word: TOUR_WORD,
      };
    case 'add-word':
      return {
        text: 'Write asun in the Kashmiri box and smile in the English one, then tap Add.',
        pose: 'kangri',
      };
    case 'word-added':
      return {
        text: 'Shabash, it’s saved. Next time you’re with family, tap the red dot next to a word and ask them to say it. Their voice will stay with you better than any spelling.',
        pose: 'cheer',
      };
    case 'flashcards':
      return {
        text: 'Flashcards quiz you on the words and phrases in your Glossary. Be honest about whether you knew one. The ones you miss come back soon, the ones you know can wait a few days.',
        pose: 'kangri',
      };
    case 'lessons':
      return {
        text: 'Lessons are proper audio courses from koshur.org. Listen along, and when a word catches your ear, save it to your Glossary.',
        pose: 'point',
      };
    case 'play':
      return {
        text: signedIn
          ? 'Play is for when you want company. Koshur Clash is a quick word race against a cousin or friend. Whoever translates faster wins.'
          : 'Play is for when you want company. Koshur Clash is a quick word race against a cousin or friend. You’ll need to sign in for this one.',
        pose: 'cheer',
      };
    case 'profile':
      return {
        text: signedIn
          ? 'Your Profile keeps count of your words and games. If you ever want me to show you round again, tap Replay Naani’s tour down here.'
          : 'Sign in here so your words are kept safe on every phone, and so you can play. Once you’re in, you can call me back from here too.',
        pose: 'point',
      };
    case 'wrap':
      return {
        text: 'That’s all of it, jaanu. Add words when you hear them and do a few flashcards each day. Come see me again pagah. That means tomorrow.',
        pose: 'wave',
      };
    default:
      return { text: '', pose: 'wave' };
  }
}
