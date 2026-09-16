import AsyncStorage from '@react-native-async-storage/async-storage';
import { addGlossaryWord, getGlossaryWords } from '@/src/services/wordService';
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
// Starter sets per level. Every entry is a `words` row that already has a
// recording, copied exactly (spelling, case, punctuation) so adding it links
// to that row and the glossary entry plays its recording straight away.
// Checked against the live `words` table on 2026-09-15. Left out on purpose:
// Posh and āb (WebM audio, which iPhones often can't play), Kakaz (its clip
// is only 6.5 KB), and samandar (Naani's tour has learners add it themselves).
// ---------------------------------------------------------------------------

type StarterEntry = { kashmiri: string; english: string };

const STARTER_SETS: Record<LearnerLevel, StarterEntry[]> = {
  beginner: [
    { kashmiri: 'Salaam', english: 'Hello' },
    { kashmiri: 'moj', english: 'mother' },
    { kashmiri: 'beni', english: 'sister' },
    { kashmiri: 'd’ad', english: 'grandmother' },
    { kashmiri: 'bude bab', english: 'grandfather' },
    { kashmiri: 'waruy', english: 'good' },
    { kashmiri: 'panch', english: 'five' },
  ],
  intermediate: [
    { kashmiri: 'd’ad', english: 'grandmother' },
    { kashmiri: 'bude bab', english: 'grandfather' },
    { kashmiri: 'moj', english: 'mother' },
    { kashmiri: 'beni', english: 'sister' },
    { kashmiri: 'tohi chu warai', english: 'are you well' },
    { kashmiri: 'Yi kus chu', english: 'Who is this' },
    { kashmiri: 'yi chu mez', english: 'this is a table' },
    { kashmiri: 'wanwun', english: 'singing' },
  ],
  understands: [
    { kashmiri: 'tohi chu warai', english: 'are you well' },
    { kashmiri: 'Yi kus chu', english: 'Who is this' },
    { kashmiri: 'yi chu mez', english: 'this is a table' },
    { kashmiri: 'samana choohaz?', english: 'do you have any luggage, sir?' },
    { kashmiri: 'waruy', english: 'good' },
    { kashmiri: 'Salaam', english: 'Hello' },
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
      await addGlossaryWord(userId, entry.kashmiri, entry.english);
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
    // non-fatal: addGlossaryWord skips words already in the glossary anyway
  }
  return missing.length > 0 ? getGlossaryWords(userId) : words;
}
