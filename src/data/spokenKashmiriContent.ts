export interface SpokenKashmiriExchange {
  image: string;
  audio: string;
  speaker: string | null;
  english: string;
}

export interface SpokenKashmiriChapterContent {
  chapter: number;
  title: string;
  intro: string;
  exchanges: SpokenKashmiriExchange[];
}

const spokenKashmiriContent = require('../../data/spoken_kashmiri_content.json') as SpokenKashmiriChapterContent[];

export function getSpokenKashmiriChapterContent(chapterNumber: number) {
  return spokenKashmiriContent.find((chapter) => chapter.chapter === chapterNumber) ?? null;
}
