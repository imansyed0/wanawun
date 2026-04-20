export interface KachruVocabItem {
  image: string; // e.g. "v1.jpg"
  audio: string; // e.g. "v1.mp3"
}

export interface KachruVocabGroup {
  title: string; // e.g. "Nouns", "Verbs", "Vocabulary"
  items: KachruVocabItem[];
}

export interface KachruChapterVocab {
  chapter: number;
  groups: KachruVocabGroup[];
}

const kachruVocabulary = require('../../data/kachru_vocabulary.json') as KachruChapterVocab[];

export function getKachruChapterVocabulary(chapterNumber: number) {
  return kachruVocabulary.find((chapter) => chapter.chapter === chapterNumber) ?? null;
}
