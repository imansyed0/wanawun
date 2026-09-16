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
    if (userId) {
      const own = parseLevel(await AsyncStorage.getItem(userLevelKey(userId)));
      if (own) return own;
    }
    const pending = parseLevel(await AsyncStorage.getItem(DEVICE_LEVEL_KEY));
    if (pending && userId) {
      // Claim it, so the next person to sign up on this phone still gets asked.
      await AsyncStorage.setItem(userLevelKey(userId), pending);
      await AsyncStorage.removeItem(DEVICE_LEVEL_KEY);
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
// Transliteration and meaning come from the Kaeshir word list; `audioId` is the
// DSAL id of S. Hassan's Kashmiri dictionary recording for that word, hosted in
// course-audio/hassan-dictionary/ (see data/dictionary_audio_manifest.json).
// Every clip below was checked against the bucket on 2026-09-16.
// ---------------------------------------------------------------------------

type StarterEntry = { kashmiri: string; english: string; audioId: string };

const STARTER_SETS: Record<LearnerLevel, StarterEntry[]> = {
  beginner: [
    { kashmiri: 'bandιgī', english: 'greetings', audioId: '00520' },
    { kashmiri: 'hamud', english: 'thank', audioId: '01447' },
    { kashmiri: 'dɔd', english: 'milk', audioId: '01030' },
    { kashmiri: 'cāy', english: 'tea', audioId: '00784' },
    { kashmiri: 'batι', english: 'rice', audioId: '00550' },
    { kashmiri: 'gιzah', english: 'food', audioId: '01392' },
    { kashmiri: 'beni', english: 'sister', audioId: '00611' },
    { kashmiri: 'dɔdι baci', english: 'child', audioId: '01035' },
    { kashmiri: 'garι', english: 'house', audioId: '01251' },
    { kashmiri: 'bar', english: 'door', audioId: '00526' },
    { kashmiri: 'gām', english: 'village', audioId: '01219' },
    { kashmiri: 'Az', english: 'today', audioId: '00384' },
    { kashmiri: 'Doh', english: 'day', audioId: '00991' },
    { kashmiri: 'anigaṭι', english: 'dusk', audioId: '00220' },
    { kashmiri: 'boḍ', english: 'big', audioId: '00695' },
  ],
  intermediate: [
    { kashmiri: 'garιwājenʸ', english: 'wife', audioId: '01253' },
    { kashmiri: 'brιtʰā', english: 'husband', audioId: '00537' },
    { kashmiri: 'haš', english: 'mother in law', audioId: '01475' },
    { kashmiri: 'hehrιbāb', english: 'father in law', audioId: '01512' },
    { kashmiri: 'astʰ', english: 'moon', audioId: '00322' },
    { kashmiri: 'bə̄riš', english: 'rain', audioId: '00678' },
    { kashmiri: 'dǝryāv', english: 'river', audioId: '00977' },
    { kashmiri: 'bāg', english: 'garden', audioId: '00562' },
    { kashmiri: 'bādām', english: 'almond', audioId: '00561' },
    { kashmiri: 'akun', english: 'tired', audioId: '00120' },
    { kashmiri: 'dōdlad', english: 'ill', audioId: '01019' },
    { kashmiri: 'dilkʰoš', english: 'easy', audioId: '00952' },
    { kashmiri: 'bǝḍʸ', english: 'old', audioId: '00696' },
    { kashmiri: 'digar', english: 'dusk', audioId: '00945' },
    { kashmiri: 'haftι', english: 'week', audioId: '01407' },
  ],
  understands: [
    { kashmiri: 'astι astι', english: 'slowly', audioId: '00323' },
    { kashmiri: 'beyi pʰiri', english: 'again', audioId: '00619' },
    { kashmiri: 'hamēšι', english: 'always', audioId: '01433' },
    { kashmiri: 'gutul', english: 'enough', audioId: '01383' },
    { kashmiri: 'bōzun', english: 'feel', audioId: '00716' },
    { kashmiri: 'dāwa karun', english: 'say', audioId: '00922' },
    { kashmiri: 'bāwun', english: 'tell', audioId: '00585' },
    { kashmiri: 'bōz', english: 'listen', audioId: '00714' },
    { kashmiri: 'hakə̄ni', english: 'real', audioId: '01411' },
    { kashmiri: 'aʦun', english: 'come', audioId: '00371' },
    { kashmiri: 'drāv', english: 'go', audioId: '01047' },
    { kashmiri: 'Diyun', english: 'give', audioId: '00960' },
    { kashmiri: 'anun', english: 'take', audioId: '00225' },
    { kashmiri: 'Bihun', english: 'sit', audioId: '00654' },
    { kashmiri: 'aḍḍι', english: 'stop', audioId: '00052' },
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
