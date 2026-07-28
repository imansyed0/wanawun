import AsyncStorage from '@react-native-async-storage/async-storage';
import { addGlossaryWord } from './wordService';
import type { WordEntry } from '@/src/types';

const STORAGE_KEY = 'pendingGlossaryWords';
const PENDING_ID_PREFIX = 'pending:';

export type PendingWord = { kashmiri: string; english: string };

/**
 * Local glossary for signed-out users. Words stashed here behave like
 * real glossary entries and are flushed into Supabase on the first
 * authenticated glossary fetch.
 */
export async function stashPendingGlossaryWord(word: PendingWord): Promise<WordEntry> {
  const trimmed = {
    kashmiri: word.kashmiri.trim(),
    english: word.english.trim(),
  };
  if (!trimmed.kashmiri || !trimmed.english) {
    throw new Error('Both Kashmiri and English are required.');
  }

  const existing = await readPendingWords();
  const key = pendingKey(trimmed);
  if (!existing.some((w) => pendingKey(w) === key)) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, trimmed]));
  }
  return pendingWordToEntry(trimmed);
}

export function isPendingWordId(id: string): boolean {
  return id.startsWith(PENDING_ID_PREFIX);
}

export async function removePendingGlossaryWord(id: string): Promise<void> {
  const existing = await readPendingWords();
  const remaining = existing.filter((w) => pendingWordToEntry(w).id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

/** The signed-out user's local glossary, shaped like real entries. */
export async function getPendingWordEntries(): Promise<WordEntry[]> {
  const pending = await readPendingWords();
  return pending
    .map(pendingWordToEntry)
    .sort((a, b) => a.kashmiri.localeCompare(b.kashmiri));
}

function pendingWordToEntry(word: PendingWord): WordEntry {
  return {
    id: `${PENDING_ID_PREFIX}${pendingKey(word)}`,
    kashmiri: word.kashmiri,
    english: word.english,
    part_of_speech: 'other',
    category: 'lesson',
    difficulty: 1,
    is_loan_word: false,
    is_phrase: word.kashmiri.includes(' '),
    audio_url: null,
  };
}

let flushInFlight: Promise<void> | null = null;

export function flushPendingGlossaryWords(userId: string): Promise<void> {
  if (!flushInFlight) {
    flushInFlight = doFlush(userId).finally(() => {
      flushInFlight = null;
    });
  }
  return flushInFlight;
}

async function doFlush(userId: string): Promise<void> {
  const pending = await readPendingWords();
  if (pending.length === 0) return;

  const failed: PendingWord[] = [];
  for (const word of pending) {
    try {
      await addGlossaryWord(userId, word.kashmiri, word.english);
    } catch {
      failed.push(word);
    }
  }

  if (failed.length > 0) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(failed));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

async function readPendingWords(): Promise<PendingWord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pendingKey(word: PendingWord) {
  return `${word.kashmiri.trim().toLowerCase()}::${word.english.trim().toLowerCase()}`;
}
