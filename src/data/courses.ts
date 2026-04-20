// Course metadata — audio and images streamed from koshur.org

import {
  getAllKoulChapters,
  KOUL_SECTION_LABELS,
  KOUL_SECTION_ORDER,
  type KoulSectionKey,
} from './koulContent';
import { getKachruChapterVocabulary } from './kachruVocabulary';

export interface AudioClip {
  filename: string; // e.g. "conv1a.mp3"
  label?: string;   // optional display label
  section?: KoulSectionKey; // Koul: which sub-section this clip belongs to
  sectionLabel?: string; // Koul: display label for the sub-section
  audioUrl?: string;   // absolute URL override (some courses host audio outside the base path)
  imageUrl?: string;   // absolute URL override for the paired image
}

export interface LessonImage {
  filename: string; // e.g. "1a.jpg"
  section?: KoulSectionKey; // Koul: which sub-section this image belongs to
  sectionLabel?: string;    // Koul: display label for the sub-section
  imageUrl?: string;        // absolute URL override
}

export interface Lesson {
  id: string;        // e.g. "spoken-ch1"
  number: number;
  title: string;
  pageUrl?: string;     // canonical lesson page on koshur.org
  audioBaseUrl: string;  // e.g. "https://koshur.org/SpokenKashmiri/Chapter1/audio/"
  audioClips: AudioClip[];
  imageBaseUrl?: string; // e.g. "https://koshur.org/SpokenKashmiri/Chapter1/images/"
  images?: LessonImage[];
}

export interface Course {
  id: string;
  title: string;
  author: string;
  description: string;
  lessons: Lesson[];
}

// ---------------------------------------------------------------------------
// 1. Introduction to Spoken Kashmiri — Prof. Braj B. Kachru
// ---------------------------------------------------------------------------

const spokenKashmiriChapters: { n: number; title: string; clips: string[]; imgs: string[] }[] = [
  { n: 1, title: 'Getting Acquainted', clips: ['Dulari','Prabha','Sheela','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv8c','namaskar','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','8c','dulari','prabha','sheela'] },
  { n: 2, title: 'A Conversation with a Coolie', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','mozur','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b'] },
  { n: 3, title: 'A Conversation with a Hotel Owner', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 4, title: 'A Conversation with a Houseboat Owner', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a'] },
  { n: 5, title: 'A Conversation with a Tonga Driver', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b'] },
  { n: 6, title: 'A Conversation with a Boatman', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a'] },
  { n: 7, title: 'A Conversation with a Taxi-driver', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b'] },
  { n: 8, title: 'A Conversation with a Tea Seller', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a'] },
  { n: 9, title: 'A Conversation at the Post Office', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a'] },
  { n: 10, title: 'A Conversation with a Milkman', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a'] },
  { n: 11, title: 'A Conversation with a Fruit Seller', clips: ['caption','caption2','caption3','caption4','caption5','caption6','caption7','conv10a','conv10b','conv11a','conv11b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','ambar','dabal'] },
  { n: 12, title: 'A Conversation with a Vegetable Seller', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a'] },
  { n: 13, title: 'A Conversation with a Sweetmeat Seller', clips: ['1','2','3','4','5','6','caption','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv13b','conv14a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','12a','12b','13a','13b','14a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','barphi','gulabjaman','kalakand','mathi','rasgola','samosa'] },
  { n: 14, title: 'A Conversation with a Flower Seller', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 15, title: 'A Conversation with a Grocer', clips: ['1','caption','conv10a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 16, title: 'A Conversation with a Butcher', clips: ['caption','conv10a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 17, title: 'A Conversation on Kashmir', clips: ['conv10a','conv10b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 18, title: 'The People of Kashmir', clips: ['caption1','caption2','caption3','caption4','caption5','caption6','caption7','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','n1','n6','title1'], imgs: ['10a','10b','11a','11b','12a','12b','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','n1'] },
  { n: 19, title: 'The Food of Kashmir', clips: ['caption1','caption2','caption3','caption4','caption5','caption6','caption7','caption8','caption9','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv13b','conv14a','conv14b','conv15a','conv15b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1','yakhin'], imgs: ['10a','10b','11a','11b','12a','12b','13a','13b','14a','14b','15a','15b','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','yakhin'] },
  { n: 20, title: 'On Sightseeing in Kashmir', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b'] },
  { n: 21, title: 'Going on a Boat Ride', clips: ['caption','caption2','caption3','caption4','caption5','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv13b','conv14a','conv14b','conv15a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','12a','12b','13a','13b','14a','14b','15a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 22, title: 'A Kashmiri Fire-pot', clips: ['1','caption','caption2','caption3','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv13b','conv14a','conv14b','conv15a','conv15b','conv16a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','12a','12b','13a','13b','14a','14b','15a','15b','16a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 23, title: 'On Going to Dal Lake', clips: ['1','caption','caption2','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','12a','12b','13a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 24, title: 'On Going to Wular Lake', clips: ['caption','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 25, title: 'On Going to Gulmarg', clips: ['conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','12a','12b','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 26, title: 'On Going to Pahalgam', clips: ['caption','conv10a','conv10b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 27, title: 'A Kashmiri Shawl Merchant', clips: ['1','2','3','4','caption','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv13b','conv14a','conv14b','conv15a','conv15b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','12a','12b','13a','13b','14a','14b','15a','15b','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 28, title: 'On Going to Hazratbal', clips: ['caption','conv10a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 29, title: 'On Visiting Tulmul Temple', clips: ['1','2','3','4','caption','caption2','caption3','caption4','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv13b','conv14a','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','halva','halvoi','luchi','title1'], imgs: ['10a','10b','11a','11b','12a','12b','13a','13b','14a','1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','halva','halvoi','luchi'] },
  { n: 30, title: 'On Going to the Amarnath Cave', clips: ['1','2','505.1','505.2','505.3','505.4','506.1','506.2','caption','caption2','caption3','conv10a','conv10b','conv11a','conv11b','conv12a','conv12b','conv13a','conv13b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','11a','11b','12a','12b','13a','13b','1a','1b','2a','2b','3a','3b','4a','4b','505.1','505.2','505.3','505.4','506.1','506.2','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','n6'] },
  { n: 31, title: 'On Going to Shankracharya Temple', clips: ['521.1','521.2','522.1','522.2','528.1','528.4','caption','conv10a','conv10b','conv1a','conv1b','conv2a','conv2b','conv3a','conv3b','conv4a','conv4b','conv5a','conv5b','conv6a','conv6b','conv7a','conv7b','conv8a','conv8b','conv9a','conv9b','title1'], imgs: ['10a','10b','1a','1b','2a','2b','3a','3b','4a','4b','521.1','521.2','522.1','522.2','528.1','528.4','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b'] },
  { n: 32, title: 'The Story of Kashmir', clips: ['1','2','3','4','5','550.1','550.2','550.3','552.1','552.2','554.1','554.2','554.3','caption','title1'], imgs: ['1','2','3','4','5','550.1','550.2','550.3','552.1','552.2','554.1','554.2','554.3'] },
  { n: 33, title: 'Dal Lake', clips: ['1','2','3','4','5','558.1','558.2','558.3','558.4','562.1','562.2','6','7','caption','title1'], imgs: ['1','2','3','4','5','558.1','558.2','558.3','558.4','562.1','562.2','6','7'] },
  { n: 34, title: 'The Gardens of Kashmir', clips: ['1','2','3','caption','title1'], imgs: ['1','2','3'] },
  { n: 35, title: 'Mahadev Bishta: A Clever Thief', clips: ['1','2','3','4','5','584.1','590.1','590.2','592.1','6a','6b','7','8a','8b','caption','title1'], imgs: ['1','2','3','4','5','584.1','590.1','590.2','592.1','6a','6b','7','8a','8b'] },
  { n: 36, title: 'Badshah: The Great King', clips: ['1a','1b','1c','title1'], imgs: ['1a','1b','1c'] },
  { n: 37, title: 'Gulmarg', clips: ['1','2','3','4','5','6','7','caption','gul','marg','title1'], imgs: ['1','2','3','4','5','6','7','marg'] },
  { n: 38, title: 'Kashmir Saffron Fields', clips: ['1','2','3','4','5','6','622.1','624.1','caption','khir','title1'], imgs: ['1','2','3','4','5','6','622.1','624.1'] },
  { n: 39, title: 'Kashmir Samovar', clips: ['1','2','3','4','5','6','630.1','630.2','630.3','632.1','632.2','632.3','7','8','caption','caption2','caption3','khos','title1'], imgs: ['1','2','3','4','5','6','630.1','630.2','630.3','632.1','632.2','632.3','7','8'] },
  { n: 40, title: 'The Muslim Rishis: Nandarishi', clips: ['1','2','3','4','5','6','640.1','640.2','644.1','title1','ziya'], imgs: ['1','2','3','4','5','6','640.1','640.2','644.1'] },
  { n: 41, title: 'Granny Lalla (Narrative)', clips: ['1','2','3','4','5','6','7','atma','avtar','caption','dh.mp3a','pir','shiva','sufi','thal','title1','vej','yogi'], imgs: ['1','2','3','4','5','6','7'] },
  { n: 42, title: 'Habba Khatun (Narrative)', clips: ['1','2','3','4','5','caption','lol','title1'], imgs: ['1','2','3','4','5'] },
  { n: 43, title: 'Gulam Ahmad \'Mahjoor\' (Narrative)', clips: ['1','2','3','4','668.1','caption','title1'], imgs: ['1','2','3','4','668.1'] },
  { n: 44, title: 'Zindakoul \'Masterji\' (Narrative)', clips: ['1','2','3','4','5','6','caption','maj','title1'], imgs: ['1','2','3','4','5','6'] },
  { n: 45, title: 'Dina Nath \'Nadim\' (Narrative)', clips: ['1a','1b','2a','2b','2c','3a','3b','3c','4','5a','5b','5c','684.1','686.1','686.2','688.1','690.1','caption','title1'], imgs: ['1a','1b','2a','2b','2c','3a','3b','3c','4','5a','5b','5c','684.1','686.1','686.2','688.1','690.1'] },
  { n: 46, title: 'Granny Lalla (Poems)', clips: ['1','2','3','4','5','title1'], imgs: ['1','2','3','4','5'] },
  { n: 47, title: 'Habba Khatun (Poems)', clips: ['1','10','11','12','13','2','3','4','5','6','7','8','9','title1'], imgs: ['1','10','11','12','13','2','3','4','5','6','7','8','9'] },
  { n: 48, title: 'Gulam Ahmad \'Mahjoor\' (Poems)', clips: ['1','2','3','bulbul','gul','title1'], imgs: ['1','2','3'] },
  { n: 49, title: 'Zindakoul \'Masterji\' (Poems)', clips: ['1','2','3','4','5','6a','6b','title1'], imgs: ['1','2','3','4','5','6a','6b'] },
  { n: 50, title: 'Dina Nath \'Nadim\' (Poems)', clips: ['1','2','3','4','5','6','7','8','dal','hay','title1'], imgs: ['1','2','3','4','5','6','7','8'] },
];

// Build vocabulary clips (scraped from each chapter's vocabulary.html) that
// get prepended to the lesson's audioClips. Using absolute URLs lets the clip
// strip reference files under the chapter's own audio/ folder without
// interfering with the base URL that the rest of the clips share.
function buildSpokenVocabClips(chapter: number): AudioClip[] {
  const vocab = getKachruChapterVocabulary(chapter);
  if (!vocab) return [];
  const clips: AudioClip[] = [];
  const audioBase = `https://koshur.org/SpokenKashmiri/Chapter${chapter}/audio/`;
  for (const group of vocab.groups) {
    group.items.forEach((item, idx) => {
      const label =
        group.items.length > 1
          ? `Vocab: ${group.title} ${idx + 1}`
          : `Vocab: ${group.title}`;
      clips.push({
        filename: item.audio,
        label,
        audioUrl: `${audioBase}${item.audio}`,
      });
    });
  }
  return clips;
}

export const spokenKashmiri: Course = {
  id: 'spoken-kashmiri',
  title: 'Introduction to Spoken Kashmiri',
  author: 'Prof. Braj B. Kachru',
  description: '50 chapters of functional conversations, narratives, and poems with audio and transliterations.',
  lessons: spokenKashmiriChapters.map(ch => {
    const vocabClips = buildSpokenVocabClips(ch.n);
    return {
      id: `spoken-ch${ch.n}`,
      number: ch.n,
      title: ch.title,
      pageUrl: `https://koshur.org/SpokenKashmiri/Chapter${ch.n}/`,
      audioBaseUrl: `https://koshur.org/SpokenKashmiri/Chapter${ch.n}/audio/`,
      audioClips: [
        ...vocabClips,
        ...ch.clips.map(c => ({ filename: `${c}.mp3`, label: c })),
      ],
      imageBaseUrl: `https://koshur.org/SpokenKashmiri/Chapter${ch.n}/images/`,
      images: ch.imgs.map(i => ({ filename: `${i}.jpg` })),
    };
  }),
};

// ---------------------------------------------------------------------------
// 2. Spoken Kashmiri: A Language Course — Omkar N. Koul
// ---------------------------------------------------------------------------

// Topic titles for each Koul chapter, sourced from koshur.org's chapter index.
const KOUL_CHAPTER_TITLES: Record<number, string> = {
  1: 'Greetings & Introductions',
  2: 'Personal Information',
  3: 'Family & Relations',
  4: 'Everyday Objects',
  5: 'Numbers & Counting',
  6: 'Time & Days',
  7: 'Food & Drink',
  8: 'Shopping',
  9: 'Directions & Travel',
  10: 'Health & Body',
  11: 'At Home',
  12: 'Weather & Seasons',
  13: 'Clothing',
  14: 'At Work',
  15: 'Leisure & Hobbies',
  16: 'Telephone & Communication',
  17: 'Making Plans',
  18: 'Describing People',
  19: 'Stories & Narratives',
  20: 'Review & Conversation',
};

export const kashmiriKoul: Course = {
  id: 'kashmiri-koul',
  title: 'Spoken Kashmiri: A Language Course',
  author: 'Omkar N. Koul',
  description:
    '20 chapters with lessons, drills, exercises, notes, and vocabulary. Audio streamed from koshur.org.',
  lessons: getAllKoulChapters()
    .slice()
    .sort((a, b) => a.chapter - b.chapter)
    .map((ch) => {
      const chapterRoot = `https://koshur.org/Kashmiri/chapter${ch.chapter}/`;
      const audioRoot = `${chapterRoot}${ch.audioPrefix}`;
      const imageRoot = `${chapterRoot}images/`;

      const audioClips: AudioClip[] = [];
      const images: LessonImage[] = [];

      for (const sectionKey of KOUL_SECTION_ORDER) {
        const sectionLabel = KOUL_SECTION_LABELS[sectionKey];
        const pairs = ch.sections[sectionKey] ?? [];
        for (const pair of pairs) {
          audioClips.push({
            filename: pair.audio,
            label: pair.audio.replace('.mp3', ''),
            section: sectionKey,
            sectionLabel,
            audioUrl: audioRoot + pair.audio,
            imageUrl: imageRoot + pair.image,
          });
          images.push({
            filename: pair.image,
            section: sectionKey,
            sectionLabel,
            imageUrl: imageRoot + pair.image,
          });
        }
      }

      const topic = KOUL_CHAPTER_TITLES[ch.chapter];
      const title = topic
        ? `Lesson ${ch.chapter}: ${topic}`
        : `Lesson ${ch.chapter}`;

      return {
        id: `koul-ch${ch.chapter}`,
        number: ch.chapter,
        title,
        pageUrl: chapterRoot,
        audioBaseUrl: audioRoot,
        audioClips,
        imageBaseUrl: imageRoot,
        images,
      };
    }),
};

// ---------------------------------------------------------------------------
// 3. CIIL Audio Cassette Course — 41 Programmes
// ---------------------------------------------------------------------------

const ciilTitles: string[] = [
  'Vowels: Short & Long',
  'Vowels: Front & Back',
  'Vowels: Central',
  'Vowels: Nasalized',
  'Vowels: Diphthongs',
  'Vowels: Practice',
  'Vowels: Review',
  'Consonants: Stops (Voiceless)',
  'Consonants: Stops (Voiced)',
  'Consonants: Aspirated',
  'Consonants: Affricates',
  'Consonants: Fricatives',
  'Consonants: Nasals',
  'Consonants: Laterals & Trills',
  'Consonants: Semivowels',
  'Consonants: Practice',
  'Consonants: Review',
  'Greetings & Introductions',
  'Asking Directions',
  'At the Market',
  'At a Restaurant',
  'At the Post Office',
  'Telling Time',
  'Weather & Seasons',
  'Family & Relations',
  'Health & Body',
  'Numbers & Counting',
  'Colors & Descriptions',
  'Daily Routine',
  'Travel & Transport',
  'Asking Questions',
  'Making Requests',
  'Past Tense',
  'Future Tense',
  'Conjunctions & Connectors',
  'Comparison & Degrees',
  'Conditional Sentences',
  'Conversation Practice 1',
  'Conversation Practice 2',
  'Review & Assessment',
  'Final Review',
];

export const ciilCourse: Course = {
  id: 'ciil',
  title: 'Audio Cassette Course in Kashmiri',
  author: 'CIIL (Central Institute of Indian Languages)',
  description: '41 programmes covering pronunciation, vocabulary, and grammar structures.',
  lessons: ciilTitles.map((title, i) => ({
    id: `ciil-prog${i + 1}`,
    number: i + 1,
    title: `Programme ${i + 1}: ${title}`,
    pageUrl: `https://koshur.org/ciil/prog${i + 1}.html`,
    audioBaseUrl: `https://koshur.org/ciil/audio/`,
    audioClips: [{ filename: `prog${i + 1}.mp3`, label: `Programme ${i + 1}` }],
    // CIIL pages don't have per-lesson translation images
  })),
};

// ---------------------------------------------------------------------------
// 4. Let's Learn Kashmiri — 34 chapters with per-clip audio
// ---------------------------------------------------------------------------
// Course chapter N maps to site chapter siteN (siteN = N + 1).
// Each chapter has its own audio directory at /LearnKashmiri/chapter{siteN}/audio/.
// Image/clip basenames are listed explicitly to handle gaps and alphanumeric suffixes.

const learnKashmiriChapters: { n: number; siteN: number; title: string; imgs: string[]; clips: string[] }[] = [
  { n: 1, siteN: 2, title: 'Words', imgs: ['1','2','3','4','5','6','7','8','9','10'], clips: ['1','2','3','4','5','6','7','8','9','10'] },
  { n: 2, siteN: 3, title: 'Counting Numbers', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13'] },
  { n: 3, siteN: 4, title: 'A Short Story', imgs: ['1','2','3','4','5','6','7','8','9','10'], clips: ['1','2','3','4','5','6','7','8','9','10'] },
  { n: 4, siteN: 5, title: 'Some Special Usages', imgs: ['1','2'], clips: ['1','2'] },
  { n: 5, siteN: 6, title: 'More Words', imgs: ['1','1a','2','2a','3','3a','4','4a','4b','5','5a','6','6a','7','7a','8','8a'], clips: ['1','1a','2','2a','3','3a','4','4a','4b','5','5a','6','6a','7','7a','8','8a'] },
  { n: 6, siteN: 7, title: 'Differentiating Sounds', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13'] },
  { n: 7, siteN: 8, title: 'Short Sentences', imgs: ['1','2','3','4','5','6'], clips: ['1','2','3','4','5','6'] },
  { n: 8, siteN: 9, title: 'Some Notes on Grammar', imgs: ['1','2','3','4','5','6','7','8','9','10','11'], clips: ['1','2','3','4','5','6','7','8','9','10','11'] },
  { n: 9, siteN: 10, title: 'Order of Words', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40'] },
  { n: 10, siteN: 11, title: 'Questions & Answers', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28'] },
  // ch11: clip 36 is missing on the site (imgs 1-47, clips 1-35 + 37-47).
  { n: 11, siteN: 12, title: 'Where, Who, What, When', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','37','38','39','40','41','42','43','44','45','46','47'] },
  // ch12: imgs/clips skip 23 and 24.
  { n: 12, siteN: 13, title: 'Question Sentences', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','25','26','27','28','29','30','31','32','33'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','25','26','27','28','29','30','31','32','33'] },
  { n: 13, siteN: 14, title: 'Time', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12'] },
  { n: 14, siteN: 15, title: 'Verbs', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18'] },
  // ch15: site numbering starts at 2 (no item 1).
  { n: 15, siteN: 16, title: 'Days of the Week', imgs: ['2','3','4','5','6','7','8','9','10','11','12','13','14','15','16'], clips: ['2','3','4','5','6','7','8','9','10','11','12','13','14','15','16'] },
  { n: 16, siteN: 17, title: 'Ordinal and Fractional Numbers and Multiples', imgs: ['1','2','3','4','5','6','7','8'], clips: ['1','2','3','4','5','6','7','8'] },
  { n: 17, siteN: 18, title: 'Pronouns', imgs: ['1','2','3','4'], clips: ['1','2','3','4'] },
  { n: 18, siteN: 19, title: 'Important Adjectives: A Short Glossary', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24'] },
  // ch19: imgs skip 27; clips skip 27 but include an extra 48.
  { n: 19, siteN: 20, title: 'More about Grammar', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48'] },
  { n: 20, siteN: 21, title: 'Relations', imgs: ['1','2','3','4','5','6','7'], clips: ['1','2','3','4','5','6','7'] },
  { n: 21, siteN: 22, title: 'Sentences showing use of Prepositions', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34'] },
  { n: 22, siteN: 23, title: 'Some Antonyms', imgs: ['1','2','3','4','5'], clips: ['1','2','3','4','5'] },
  // ch23: extra 'title.mp3' clip at end.
  { n: 23, siteN: 24, title: "God's Eleven", imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','title'] },
  // ch24: no audio clips on site.
  { n: 24, siteN: 25, title: 'Some Idiomatic Phrases', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35'], clips: [] },
  { n: 25, siteN: 26, title: 'More Proverbs/Idioms', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22'] },
  { n: 26, siteN: 27, title: 'A Letter in Kashmiri', imgs: ['1','2','3','4','5','6'], clips: ['1','2','3','4','5','6'] },
  // ch27: extra 'title.mp3'.
  { n: 27, siteN: 28, title: 'Well Cooked Rice', imgs: ['1','2','3','4','5','6','7','8','9','10'], clips: ['1','2','3','4','5','6','7','8','9','10','title'] },
  // ch28: imgs/clips skip 2; extra 'title.mp3'.
  { n: 28, siteN: 29, title: 'A Pick Pocket', imgs: ['1','3','4','5','6','7','8','9','10','11','12','13'], clips: ['1','3','4','5','6','7','8','9','10','11','12','13','title'] },
  // ch29: no audio clips on site.
  { n: 29, siteN: 30, title: 'A Riddle', imgs: ['1','2','3','4','5','6'], clips: [] },
  // ch30: extra 'title.mp3'.
  { n: 30, siteN: 31, title: 'An Affirmation of Human Oneness', imgs: ['1','2','3','4','5','6','7'], clips: ['1','2','3','4','5','6','7','title'] },
  // ch31: no audio clips on site.
  { n: 31, siteN: 32, title: 'The Dhammapada', imgs: ['1','2','3','4','5','6','7','8','9','10'], clips: [] },
  { n: 32, siteN: 33, title: 'Some Common Usages', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'] },
  { n: 33, siteN: 34, title: 'Some Couplets from Great Kashmiri Poets', imgs: ['1','2','3','4','5','6'], clips: ['1','2','3','4','5','6'] },
  { n: 34, siteN: 35, title: 'To Remember by Heart', imgs: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21'], clips: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21'] },
];

export const learnKashmiri: Course = {
  id: 'learn-kashmiri',
  title: "Let's Learn Kashmiri",
  author: 'Koshur.org',
  description: '34 chapters of vocabulary, grammar, conversations, and poetry with per-clip audio.',
  lessons: learnKashmiriChapters.map(ch => ({
    id: `learn-ch${ch.n}`,
    number: ch.n,
    title: `Chapter ${ch.n}: ${ch.title}`,
    pageUrl: `https://koshur.org/LearnKashmiri/chapter${ch.siteN}/`,
    audioBaseUrl: `https://koshur.org/LearnKashmiri/chapter${ch.siteN}/audio/`,
    audioClips: ch.clips.map(c => ({ filename: `${c}.mp3`, label: c })),
    imageBaseUrl: `https://koshur.org/LearnKashmiri/chapter${ch.siteN}/images/`,
    images: ch.imgs.map(i => ({ filename: `${i}.jpg` })),
  })),
};

// ---------------------------------------------------------------------------
// All courses
// ---------------------------------------------------------------------------

export const allCourses: Course[] = [
  spokenKashmiri,
  kashmiriKoul,
  ciilCourse,
  // Temporarily hidden — the Let's Learn Kashmiri course is disabled in the app.
  // learnKashmiri,
];
