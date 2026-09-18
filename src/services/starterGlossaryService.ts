import AsyncStorage from '@react-native-async-storage/async-storage';
import { addGlossaryWord, getGlossaryWords } from '@/src/services/wordService';
import { linkAudioToWord } from '@/src/services/audioService';
import { dictionaryAudioUrls } from '@/src/lib/englishDictionary';
import type { WordEntry } from '@/src/types';

/**
 * Adds a learner's starter words to their glossary, picked from the level
 * they chose when Naani asked. Each level's set is added once per account,
 * whether or not the glossary already had words: words already there are
 * skipped, and deleting starter words never brings them back.
 */

// ---------------------------------------------------------------------------
// Learner level (Naani's first question)
// ---------------------------------------------------------------------------

export type LearnerLevel = 'beginner' | 'intermediate' | 'understands';

const LEVELS: LearnerLevel[] = ['beginner', 'intermediate', 'understands'];

// The question is asked before the account exists, so the answer waits on the
// device and moves onto the account the first time that account reads it.
const DEVICE_LEVEL_KEY = 'learnerLevel:device';
const userLevelKey = (userId: string) => `learnerLevel:${userId}`;

function parseLevel(raw: string | null): LearnerLevel | null {
  return raw && (LEVELS as string[]).includes(raw) ? (raw as LearnerLevel) : null;
}

export async function getLearnerLevel(userId?: string): Promise<LearnerLevel | null> {
  try {
    const pending = parseLevel(await AsyncStorage.getItem(DEVICE_LEVEL_KEY));

    if (userId) {
      const own = parseLevel(await AsyncStorage.getItem(userLevelKey(userId)));
      // Either way the device's answer has found its owner, so clear it: it is
      // only there to carry an answer given before signing in, and left behind
      // it is the answer everyone else on this phone is read as having given.
      if (pending) {
        if (!own) await AsyncStorage.setItem(userLevelKey(userId), pending);
        await AsyncStorage.removeItem(DEVICE_LEVEL_KEY);
      }
      return own ?? pending;
    }

    return pending;
  } catch {
    return null;
  }
}

export async function saveLearnerLevel(level: LearnerLevel, userId?: string): Promise<void> {
  await AsyncStorage.setItem(userId ? userLevelKey(userId) : DEVICE_LEVEL_KEY, level);
}

// ---------------------------------------------------------------------------
// Starter sets per level.
//
// Transliteration and meaning are the headword and gloss of S. Hassan's Kashmiri
// dictionary entry (data/hassan_dictionary_full.csv); `audioId` is the DSAL id of
// that entry's recording, hosted in course-audio/hassan-dictionary/ (see
// data/dictionary_audio_manifest.json). Every clip below was checked against the
// bucket on 2026-09-19.
//
// Reviewed by a Kashmiri speaker on 2026-09-19. Two rules came out of it: keep
// everyday speech over the formal register (bandιgī, hamud and gιzah were all
// cut for being too formal), and prefer the word people actually say — rūd for
// rain, not the literary bə̄riš.
// ---------------------------------------------------------------------------

type StarterEntry = { kashmiri: string; english: string; audioId: string };

const STARTER_SETS: Record<LearnerLevel, StarterEntry[]> = {
  beginner: [
    { kashmiri: 'āb', english: 'water', audioId: '00405' },
    { kashmiri: 'dɔd', english: 'milk', audioId: '01030' },
    { kashmiri: 'cāy', english: 'tea', audioId: '00784' },
    { kashmiri: 'batι', english: 'rice', audioId: '00550' },
    { kashmiri: 'kʰen', english: 'food', audioId: '01998' },
    { kashmiri: 'beni', english: 'sister', audioId: '00611' },
    { kashmiri: 'šur', english: 'child', audioId: '03873' },
    { kashmiri: 'garι', english: 'house', audioId: '01251' },
    { kashmiri: 'bar', english: 'door', audioId: '00526' },
    { kashmiri: 'gām', english: 'village', audioId: '01219' },
    { kashmiri: 'az', english: 'today', audioId: '00384' },
    { kashmiri: 'subhan', english: 'tomorrow', audioId: '03846' },
    { kashmiri: 'doh', english: 'day', audioId: '00991' },
    { kashmiri: 'anigaṭι', english: 'dusk', audioId: '00220' },
    { kashmiri: 'boḍ', english: 'big', audioId: '00695' },
  ],
  intermediate: [
    { kashmiri: 'garιwājenʸ', english: 'wife', audioId: '01253' },
    { kashmiri: 'rūn', english: 'husband', audioId: '03484' },
    { kashmiri: 'haš', english: 'mother-in-law', audioId: '01475' },
    { kashmiri: 'hehrιbāb', english: 'father-in-law', audioId: '01512' },
    { kashmiri: 'zūn', english: 'moon', audioId: '04855' },
    { kashmiri: 'rūd', english: 'rain', audioId: '03475' },
    { kashmiri: 'dǝryāv', english: 'river', audioId: '00977' },
    { kashmiri: 'bāg', english: 'garden', audioId: '00562' },
    { kashmiri: 'bādām', english: 'almond', audioId: '00561' },
    { kashmiri: 'akun', english: 'tired', audioId: '00120' },
    { kashmiri: 'dōdlad', english: 'ill', audioId: '01019' },
    { kashmiri: 'āsān', english: 'easy', audioId: '00442' },
    { kashmiri: 'bǝḍʸ', english: 'old', audioId: '00696' },
    { kashmiri: 'šām', english: 'evening', audioId: '03580' },
    { kashmiri: 'haftι', english: 'week', audioId: '01407' },
  ],
  // Phrases, not single words. This group already has the vocabulary and freezes
  // on their turn to speak, so what they need is the joins — asking, hedging,
  // saying when — which are the hardest thing to produce from a word list.
  understands: [
    { kashmiri: 'kitʰ pə̄ṭʰ', english: 'how', audioId: '02090' },
    { kashmiri: 'kami wakʰtι', english: 'when', audioId: '01770' },
    { kashmiri: 'yitʰ pə̄ṭʰ', english: 'like this', audioId: '04679' },
    { kashmiri: 'yeti tati', english: 'anyway', audioId: '04700' },
    { kashmiri: 'yemi kʰātrι', english: 'therefore', audioId: '04667' },
    { kashmiri: 'pǝz pʸῑṭʰ', english: 'certainly', audioId: '03168' },
    { kashmiri: 'zaⁿh nι', english: 'never', audioId: '04768' },
    { kashmiri: 'astι astι', english: 'slowly', audioId: '00323' },
    { kashmiri: 'jaṭʰ paṭʰ', english: 'quickly', audioId: '05600' },
    { kashmiri: 'beyi pʰiri', english: 'again', audioId: '00619' },
    { kashmiri: 'yeli teli', english: 'now and then', audioId: '04663' },
    { kashmiri: 'hǝna ṭʰιrit', english: 'after a while', audioId: '01517' },
    { kashmiri: 'har dōh', english: 'every day', audioId: '01600' },
    { kashmiri: 'asān asān', english: 'gladly', audioId: '00299' },
    { kashmiri: 'wārι kārι', english: "you're welcome", audioId: '04623' },
  ],
};

/** Pure: learner level → starter list. */
export function pickStarterEntries(level: LearnerLevel): StarterEntry[] {
  return STARTER_SETS[level];
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

// Records which level's set this account has already had, so the set is added
// once. (The older `starterGlossarySeeded:*` flag only allowed seeding into an
// empty glossary, which skipped anyone who already had words; it's ignored.)
const addedLevelKey = (userId: string) => `starterWordsAdded:${userId}`;

const entryKey = (kashmiri: string, english: string) =>
  `${kashmiri.trim()}::${english.trim()}`.toLowerCase();

// One in-flight run per account, so strict-mode double effects and
// overlapping focus loads share a single seeding pass.
const inFlight = new Map<string, Promise<WordEntry[]>>();

/**
 * Drop-in replacement for getGlossaryWords(): returns the glossary, adding the
 * learner's starter words first if their level's set hasn't been added yet.
 */
export function getGlossaryWordsWithStarters(userId?: string): Promise<WordEntry[]> {
  // Starter words go onto the account, and signing in is required.
  if (!userId) return getGlossaryWords(userId);

  const existing = inFlight.get(userId);
  if (existing) return existing;

  const run = loadAndSeed(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, run);
  return run;
}

async function loadAndSeed(userId: string): Promise<WordEntry[]> {
  const words = await getGlossaryWords(userId);

  // Naani hasn't asked yet: nothing to pick from.
  const level = await getLearnerLevel(userId);
  if (!level) return words;

  try {
    if ((await AsyncStorage.getItem(addedLevelKey(userId))) === level) return words;
  } catch {
    // Can't tell whether they were added — don't risk adding them twice.
    return words;
  }

  const have = new Set(words.map((w) => entryKey(w.kashmiri, w.english)));
  const missing = pickStarterEntries(level).filter(
    (entry) => !have.has(entryKey(entry.kashmiri, entry.english))
  );

  let failed = 0;
  for (const entry of missing) {
    try {
      const word = await addGlossaryWord(userId, entry.kashmiri, entry.english);
      // Give the word its dictionary recording, unless it already has one.
      if (!word.audio_url && !word.id.startsWith('lesson-vocab:')) {
        const [audioUrl] = dictionaryAudioUrls(entry.audioId);
        if (audioUrl) await linkAudioToWord(word.id, audioUrl);
      }
    } catch (error) {
      failed++;
      console.warn('Starter glossary word failed:', entry.kashmiri, error);
    }
  }

  // Everything failed (e.g. offline): don't record it, so the next load retries.
  if (missing.length > 0 && failed === missing.length) return words;

  try {
    await AsyncStorage.setItem(addedLevelKey(userId), level);
  } catch {
    // non-fatal: words already in the glossary are skipped anyway
  }
  return missing.length > 0 ? getGlossaryWords(userId) : words;
}
