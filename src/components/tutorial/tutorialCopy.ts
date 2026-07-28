import type { GrandmotherPose } from '@/src/components/onboarding/Grandmother';
import type { TutorialStep } from '@/src/stores/tutorialStore';

export const INTRO_LINES = [
  'Salaam, jaana! Come, sit. I’m your d’ad — your Kashmiri grandmother.',
  'This app has one secret: collect words in your glossary, then practise them until they stick. Everything else is decoration.',
  'Let’s do it once together, with a real word.',
];

export const GLOSSARY_PATH = '/learn';
export const FLASHCARDS_PATH = '/flashcards';

export type Bubble = {
  text: string;
  pose: GrandmotherPose;
};

export function getBubble(
  step: TutorialStep,
  onGlossary: boolean,
  onFlashcards: boolean,
  lastAnswer: 'right' | 'wrong' | null,
  hadWrong: boolean
): Bubble {
  switch (step) {
    case 'open-add':
      if (!onGlossary) {
        return {
          text: 'First, tap the Glossary tab below — that’s where your words live.',
          pose: 'point',
        };
      }
      return {
        text: 'Tap the + button and save my word: d’ad — it means grandmother.',
        pose: 'point',
      };
    case 'add-word':
      return {
        text: 'Type the Kashmiri and the English, then tap Add. Use mine: d’ad — grandmother.',
        pose: 'kangri',
      };
    case 'word-added':
      return {
        text: 'Shabash! Your first word is safe. Now tap Flashcards below — that’s where words become yours.',
        pose: 'cheer',
      };
    case 'practice':
      if (!onFlashcards) {
        return {
          text: 'Come back to the Flashcards tab, jaana — we’re not done!',
          pose: 'point',
        };
      }
      if (lastAnswer === 'wrong') {
        return {
          text: 'No shame in that! Watch — I’ll bring it back until you know it. That’s my little trick.',
          pose: 'kangri',
        };
      }
      if (lastAnswer === 'right') {
        return {
          text: 'Shabash! Keep going.',
          pose: 'cheer',
        };
      }
      return {
        text: 'Reveal the answer, then be honest — did you know it? The ones you miss, I bring back.',
        pose: 'kangri',
      };
    case 'wrap':
      return {
        text: hadWrong
          ? 'You saw it yourself — missed words come back until they’re yours. So: save words from lessons, and visit me here pagah — tomorrow!'
          : 'You knew them — shabash! When you do miss one, I’ll bring it back until it sticks. Save words from lessons, and visit me pagah — tomorrow!',
        pose: 'cheer',
      };
    default:
      return { text: '', pose: 'wave' };
  }
}
