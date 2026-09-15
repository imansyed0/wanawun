import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import { addGlossaryWord, getGlossaryWords } from '@/src/services/wordService';
import { stashPendingGlossaryWord } from '@/src/services/pendingGlossaryService';
import type { WordEntry } from '@/src/types';

/**
 * Seeds a brand-new learner's glossary with a handful of starter words,
 * picked from their personalisation answers. Runs at most once per
 * account (or once per device for signed-out users): deleting starter
 * words never brings them back.
 */

// ---------------------------------------------------------------------------
// Personalisation
// ---------------------------------------------------------------------------

export type SpeakWith = 'grandparents' | 'parents' | 'in-laws' | 'friends';
export type LearningGoal = 'conversation' | 'food' | 'visit-kashmir' | 'heritage';

export interface LearnerPersonalisation {
  speakWith?: SpeakWith[];
  goals?: LearningGoal[];
}

const PERSONALISATION_KEY = 'learnerPersonalisation';

export async function getLearnerPersonalisation(): Promise<LearnerPersonalisation | null> {
  try {
    const raw = await AsyncStorage.getItem(PERSONALISATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveLearnerPersonalisation(value: LearnerPersonalisation): Promise<void> {
  await AsyncStorage.setItem(PERSONALISATION_KEY, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Curated starter sets — Kashmiri/English copied verbatim from
// data/glossary.json (the source of the `words` table), so inserts link
// to the existing dictionary row and pick up its audio when it has one.
// d’ad (grandmother) is deliberately left out: it's the word Naani's
// tutorial asks the learner to add themselves.
// ---------------------------------------------------------------------------

type StarterEntry = { kashmiri: string; english: string };

const HELLO: StarterEntry = { kashmiri: 'namaskār', english: 'greetings, goodbye, hello' };

const STARTER_SETS = {
  everyday: [
    HELLO,
    { kashmiri: 'thīkh', english: 'good, right, fair, correct' },
    { kashmiri: 'na', english: 'no' },
    { kashmiri: 'k’ā', english: 'what' },
    { kashmiri: 'kati', english: 'where' },
    { kashmiri: 'chāy', english: 'tea' },
    { kashmiri: 'tsot', english: 'bread' },
    { kashmiri: 'garə', english: 'home' },
    { kashmiri: 'pagah', english: 'tomorrow' },
  ],
  family: [
    HELLO,
    { kashmiri: 'māj', english: 'mother' },
    { kashmiri: 'mōl', english: 'father' },
    { kashmiri: 'bōr', english: 'brother' },
    { kashmiri: 'beni', english: 'sister' },
    { kashmiri: 'nechuv', english: 'son' },
    { kashmiri: 'kūr', english: 'girl, daughter' },
    { kashmiri: 'shurah', english: 'child' },
  ],
  inLaws: [
    HELLO,
    { kashmiri: 'hash', english: 'mother-in-law' },
    { kashmiri: 'h’uhur', english: 'father-in-law' },
    { kashmiri: 'khādar', english: 'wedding' },
    { kashmiri: 'mahren’', english: 'bride' },
  ],
  friends: [
    HELLO,
    { kashmiri: 'dōst', english: 'friend(s)' },
    { kashmiri: 'yār', english: 'friend' },
  ],
  food: [
    { kashmiri: 'chāy', english: 'tea' },
    { kashmiri: 'kahvə', english: 'Kashmiri tea' },
    { kashmiri: 'tsot', english: 'bread' },
    { kashmiri: 'tomul', english: 'rice (uncooked)' },
    { kashmiri: 'rōganjōsh', english: 'a Kashmiri meat dish' },
    { kashmiri: 'yakhən’', english: 'A Kashmiri meat dish cooked with yogurt' },
    { kashmiri: 'kh’on', english: 'eat' },
  ],
  travel: [
    HELLO,
    { kashmiri: 'sirīnagar', english: 'Srinagar (place name)' },
    { kashmiri: 'dal', english: 'Dal Lake' },
    { kashmiri: 'nāv', english: 'boat' },
    { kashmiri: 'koh', english: 'mountain(s)' },
    { kashmiri: 'kati', english: 'where' },
    { kashmiri: 'khūbsūr', english: 'beautiful' },
  ],
} satisfies Record<string, StarterEntry[]>;

const MAX_STARTER_WORDS = 10;

/** Pure: personalisation answers → ordered, de-duplicated starter list. */
export function pickStarterEntries(p: LearnerPersonalisation | null): StarterEntry[] {
  const sets: StarterEntry[][] = [];
  const speakWith = p?.speakWith ?? [];
  const goals = p?.goals ?? [];

  if (speakWith.includes('grandparents') || speakWith.includes('parents') || goals.includes('heritage')) {
    sets.push(STARTER_SETS.family);
  }
  if (speakWith.includes('in-laws')) sets.push(STARTER_SETS.inLaws);
  if (speakWith.includes('friends')) sets.push(STARTER_SETS.friends);
  if (goals.includes('food')) sets.push(STARTER_SETS.food);
  if (goals.includes('visit-kashmir')) sets.push(STARTER_SETS.travel);
  // Everyday words always top up the list (and are the whole list when
  // there are no answers).
  sets.push(STARTER_SETS.everyday);

  // Round-robin across the chosen sets so several answers each get a say.
  const picked = new Map<string, StarterEntry>();
  const longest = Math.max(...sets.map((s) => s.length));
  for (let i = 0; i < longest && picked.size < MAX_STARTER_WORDS; i++) {
    for (const set of sets) {
      const entry = set[i];
      if (!entry) continue;
      const key = `${entry.kashmiri}::${entry.english}`.toLowerCase();
      if (!picked.has(key)) picked.set(key, entry);
      if (picked.size >= MAX_STARTER_WORDS) break;
    }
  }
  return Array.from(picked.values());
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

const GUEST_FLAG_KEY = 'starterGlossarySeeded:guest';
const userFlagKey = (userId: string) => `starterGlossarySeeded:${userId}`;

async function isFlagSet(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === 'true';
  } catch {
    // Can't tell — err on the side of not seeding.
    return true;
  }
}

async function setFlag(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, 'true');
  } catch {
    // non-fatal
  }
}

// One in-flight run per scope, so strict-mode double effects and
// overlapping focus loads share a single seeding pass.
const inFlight = new Map<string, Promise<WordEntry[]>>();

/**
 * Drop-in replacement for getGlossaryWords(): returns the glossary,
 * seeding starter words first if this learner has never had any.
 */
export function getGlossaryWordsWithStarters(userId?: string): Promise<WordEntry[]> {
  const scope = userId ?? 'guest';
  const existing = inFlight.get(scope);
  if (existing) return existing;

  const run = loadAndSeed(userId).finally(() => inFlight.delete(scope));
  inFlight.set(scope, run);
  return run;
}

async function loadAndSeed(userId?: string): Promise<WordEntry[]> {
  const words = await getGlossaryWords(userId);
  const flagKey = userId ? userFlagKey(userId) : GUEST_FLAG_KEY;

  if (await isFlagSet(flagKey)) return words;

  if (words.length > 0) {
    // Existing learner — never seed them later, even if they empty it.
    await setFlag(flagKey);
    return words;
  }

  if (userId) {
    // Starter words seeded as a guest on this device were already
    // offered; if they were deleted, don't bring them back on sign-in.
    if (await isFlagSet(GUEST_FLAG_KEY)) {
      await setFlag(flagKey);
      return words;
    }
  } else {
    // useAuth starts with user = null while the session restores. Don't
    // stash guest words for someone who is actually signed in — they'd be
    // flushed into their account on the next load.
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return words;
    } catch {
      return words;
    }
  }

  const entries = pickStarterEntries(await getLearnerPersonalisation());
  let added = 0;
  for (const entry of entries) {
    try {
      if (userId) {
        await addGlossaryWord(userId, entry.kashmiri, entry.english);
      } else {
        await stashPendingGlossaryWord(entry);
      }
      added++;
    } catch (error) {
      console.warn('Starter glossary word failed:', entry.kashmiri, error);
    }
  }

  // Total failure (e.g. offline): leave the flag unset and retry next load.
  if (added === 0) return words;

  await setFlag(flagKey);
  return getGlossaryWords(userId);
}
