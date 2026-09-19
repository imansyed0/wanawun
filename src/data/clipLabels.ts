// Context-aware nouns for lesson audio clips. The player used to call every
// recording a "clip"; these helpers name it after what it actually is in the
// course/section it belongs to ("Phrase 3/20", "12 drills", ...).

import type { AudioClip, Lesson } from './courses';
import type { KoulSectionKey } from './koulContent';

const KOUL_SECTION_NOUNS: Record<KoulSectionKey, string> = {
  lesson: 'Lesson',
  drills: 'Drill',
  exercises: 'Exercise',
  notes: 'Note',
  vocabulary: 'Word',
};

// Kachru chapters 1-31 are conversations, 32-45 narratives, 46-50 poems.
const SPOKEN_NARRATIVE_FROM_CHAPTER = 32;

function spokenKashmiriNoun(lesson: Lesson): string {
  if (/poem/i.test(lesson.title)) return 'Verse';
  if (lesson.number >= SPOKEN_NARRATIVE_FROM_CHAPTER) return 'Story';
  return 'Phrase';
}

/** Singular noun for a lesson's recordings as a whole. */
export function getLessonClipNoun(courseId: string, lesson: Lesson): string {
  switch (courseId) {
    case 'spoken-kashmiri':
      return spokenKashmiriNoun(lesson);
    case 'kashmiri-koul':
      return 'Recording';
    case 'ciil':
      // A CIIL lesson is a single recording, so its clip noun is the unit the
      // rest of the app uses for a lesson — not the cassette's "programme".
      return 'Lesson';
    case 'learn-kashmiri':
      return 'Phrase';
    default:
      return 'Clip';
  }
}

/** Singular noun for one clip, derived from its section when it has one. */
export function getClipNoun(
  courseId: string,
  lesson: Lesson,
  clip?: AudioClip
): string {
  if (clip?.section) return KOUL_SECTION_NOUNS[clip.section];
  if (clip?.label?.startsWith('Vocab:')) return 'Word';
  return getLessonClipNoun(courseId, lesson);
}

/** Noun for every clip in a Koul section ("Drill"). */
export function getKoulSectionClipNoun(section: KoulSectionKey): string {
  return KOUL_SECTION_NOUNS[section];
}

/** "1 phrase", "3 stories". */
export function formatClipCount(count: number, noun: string): string {
  const lower = noun.toLowerCase();
  if (count === 1) return `${count} ${lower}`;
  const plural = /[^aeiou]y$/.test(lower) ? `${lower.slice(0, -1)}ies` : `${lower}s`;
  return `${count} ${plural}`;
}
