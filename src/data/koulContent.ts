export interface KoulMediaPair {
  image: string; // e.g. "1.1.jpg"
  audio: string; // e.g. "1.1.mp3"
}

export type KoulSectionKey =
  | 'lesson'
  | 'drills'
  | 'exercises'
  | 'notes'
  | 'vocabulary';

export interface KoulChapterContent {
  chapter: number;
  title: string;
  audioPrefix: string; // always "audio/"; the chapter HTML pages use broken
                       // relative paths, but the real MP3s live under /audio/
                       // on koshur.org for every chapter (verified April 2026).
  sections: Record<KoulSectionKey, KoulMediaPair[]>;
}

const koulContent = require('../../data/koul_content.json') as KoulChapterContent[];

export const KOUL_SECTION_LABELS: Record<KoulSectionKey, string> = {
  lesson: 'Lesson',
  drills: 'Drills',
  exercises: 'Exercises',
  notes: 'Notes',
  vocabulary: 'Vocabulary',
};

export const KOUL_SECTION_ORDER: KoulSectionKey[] = [
  'lesson',
  'drills',
  'exercises',
  'notes',
  'vocabulary',
];

export function getKoulChapterContent(chapterNumber: number) {
  return koulContent.find((chapter) => chapter.chapter === chapterNumber) ?? null;
}

export function getAllKoulChapters(): KoulChapterContent[] {
  return koulContent;
}
