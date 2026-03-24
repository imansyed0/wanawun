// Course metadata — audio and images streamed from koshur.org

export interface AudioClip {
  filename: string; // e.g. "conv1a.mp3"
  label?: string;   // optional display label
}

export interface LessonImage {
  filename: string; // e.g. "1a.jpg"
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

export const spokenKashmiri: Course = {
  id: 'spoken-kashmiri',
  title: 'Introduction to Spoken Kashmiri',
  author: 'Prof. Braj B. Kachru',
  description: '50 chapters of functional conversations, narratives, and poems with audio and transliterations.',
  lessons: spokenKashmiriChapters.map(ch => ({
    id: `spoken-ch${ch.n}`,
    number: ch.n,
    title: ch.title,
    pageUrl: `https://koshur.org/SpokenKashmiri/Chapter${ch.n}/`,
    audioBaseUrl: `https://koshur.org/SpokenKashmiri/Chapter${ch.n}/audio/`,
    audioClips: ch.clips.map(c => ({ filename: `${c}.mp3`, label: c })),
    imageBaseUrl: `https://koshur.org/SpokenKashmiri/Chapter${ch.n}/images/`,
    images: ch.imgs.map(i => ({ filename: `${i}.jpg` })),
  })),
};

// ---------------------------------------------------------------------------
// 2. Spoken Kashmiri: A Language Course — Omkar N. Koul
// ---------------------------------------------------------------------------

const koulChapters: { n: number; title: string; clipCount: number }[] = [
  { n: 1, title: 'Lesson 1: Greetings & Introduction', clipCount: 8 },
  { n: 2, title: 'Lesson 2: Shopping', clipCount: 8 },
  { n: 3, title: 'Lesson 3: Food & Drink', clipCount: 7 },
  { n: 4, title: 'Lesson 4: Travel & Transport', clipCount: 8 },
];

export const kashmiriKoul: Course = {
  id: 'kashmiri-koul',
  title: 'Spoken Kashmiri: A Language Course',
  author: 'Omkar N. Koul',
  description: 'Structured language course with drills, exercises, and vocabulary.',
  lessons: koulChapters.map(ch => ({
    id: `koul-ch${ch.n}`,
    number: ch.n,
    title: ch.title,
    pageUrl: `https://koshur.org/Kashmiri/chapter${ch.n}/`,
    audioBaseUrl: `https://koshur.org/Kashmiri/chapter${ch.n}/audio/`,
    audioClips: Array.from({ length: ch.clipCount }, (_, i) => ({
      filename: `${ch.n}.${i + 1}.mp3`,
      label: `${ch.n}.${i + 1}`,
    })),
    imageBaseUrl: `https://koshur.org/Kashmiri/chapter${ch.n}/images/`,
    images: Array.from({ length: ch.clipCount }, (_, i) => ({
      filename: `${ch.n}.${i + 1}.jpg`,
    })),
  })),
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
    pageUrl: 'https://koshur.org/ciil/',
    audioBaseUrl: `https://koshur.org/ciil/audio/`,
    audioClips: [{ filename: `prog${i + 1}.mp3`, label: `Programme ${i + 1}` }],
    // CIIL pages don't have per-lesson translation images
  })),
};

// ---------------------------------------------------------------------------
// 4. Let's Learn Kashmiri — 12 audio tracks across 35 chapters
// ---------------------------------------------------------------------------

const learnKashmiriChapters: { n: number; title: string; trackNum: number }[] = [
  { n: 1, title: 'Words', trackNum: 2 },
  { n: 2, title: 'Counting Numbers', trackNum: 3 },
  { n: 3, title: 'A Short Story', trackNum: 4 },
  { n: 4, title: 'Some Special Usages', trackNum: 5 },
  { n: 5, title: 'More Words', trackNum: 6 },
  { n: 6, title: 'Differentiating Sounds', trackNum: 7 },
  { n: 7, title: 'Short Sentences', trackNum: 8 },
  { n: 8, title: 'Some Notes on Grammar', trackNum: 9 },
  { n: 9, title: 'Order of Words', trackNum: 10 },
  { n: 10, title: 'Questions & Answers', trackNum: 11 },
  { n: 11, title: 'Where, Who, What, When', trackNum: 12 },
  { n: 12, title: 'Question Sentences', trackNum: 13 },
];

export const learnKashmiri: Course = {
  id: 'learn-kashmiri',
  title: "Let's Learn Kashmiri",
  author: 'Koshur.org',
  description: '12 audio lessons covering vocabulary, grammar, and sentences.',
  lessons: learnKashmiriChapters.map(ch => ({
    id: `learn-ch${ch.n}`,
    number: ch.n,
    title: `Chapter ${ch.n}: ${ch.title}`,
    pageUrl: 'https://koshur.org/LearnKashmiri/',
    audioBaseUrl: `https://koshur.org/LearnKashmiri/mp3/audio/`,
    audioClips: [{ filename: `${ch.trackNum}.mp3`, label: ch.title }],
    // No per-chapter images for LearnKashmiri
  })),
};

// ---------------------------------------------------------------------------
// All courses
// ---------------------------------------------------------------------------

export const allCourses: Course[] = [
  spokenKashmiri,
  kashmiriKoul,
  ciilCourse,
  learnKashmiri,
];
