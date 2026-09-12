import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import { createCard, type SrsCard } from '@/src/lib/srs';
import type { WordEntry } from '@/src/types';

/**
 * Storage for flashcard review state.
 *
 * AsyncStorage is the source of truth during a session so reviews never block
 * on the network; Supabase is a write-through mirror for signed-in users so
 * scheduling follows them across devices.
 */

const STORAGE_KEY_PREFIX = 'flashcard_srs';

/** Kashmiri prompt -> English answer, and the reverse. */
export const REVIEW_DIRECTIONS = ['k2e', 'e2k'] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

export interface DeckItem {
  card: SrsCard;
  word: WordEntry;
  direction: ReviewDirection;
}

type CardCache = Record<string, SrsCard>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identity for a word independent of which row it came from — the same key
 * `wordService` uses to de-duplicate the glossary, so review history survives
 * a word being re-added or synced up from a signed-out session.
 */
export function wordContentKey(word: Pick<WordEntry, 'kashmiri' | 'english'>): string {
  return `${word.kashmiri.trim().toLowerCase()}::${word.english.trim().toLowerCase()}`;
}

export function cardKeyFor(
  word: Pick<WordEntry, 'kashmiri' | 'english'>,
  direction: ReviewDirection
): string {
  return `${wordContentKey(word)}::${direction}`;
}

function directionFromKey(key: string): ReviewDirection {
  return key.endsWith('::e2k') ? 'e2k' : 'k2e';
}

function storageKey(userId?: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : `${STORAGE_KEY_PREFIX}:anonymous`;
}

async function readCache(userId?: string | null): Promise<CardCache> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CardCache) : {};
  } catch {
    return {};
  }
}

async function writeCache(cache: CardCache, userId?: string | null): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(cache));
}

type SrsRow = {
  card_key: string;
  state: SrsCard['state'];
  ease: number;
  interval_days: number;
  step_index: number;
  due_at: string;
  reps: number;
  lapses: number;
  introduced_at: string | null;
  last_reviewed_at: string | null;
};

function rowToCard(row: SrsRow): SrsCard {
  return {
    key: row.card_key,
    state: row.state,
    ease: row.ease,
    intervalDays: row.interval_days,
    stepIndex: row.step_index,
    dueAt: new Date(row.due_at).getTime(),
    reps: row.reps,
    lapses: row.lapses,
    introducedAt: row.introduced_at ? new Date(row.introduced_at).getTime() : null,
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).getTime() : null,
  };
}

function cardToRow(userId: string, card: SrsCard, word: WordEntry) {
  return {
    user_id: userId,
    card_key: card.key,
    word_id: UUID_PATTERN.test(word.id) ? word.id : null,
    direction: directionFromKey(card.key),
    state: card.state,
    ease: card.ease,
    interval_days: card.intervalDays,
    step_index: card.stepIndex,
    due_at: new Date(card.dueAt).toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    introduced_at: card.introducedAt ? new Date(card.introducedAt).toISOString() : null,
    last_reviewed_at: card.lastReviewedAt ? new Date(card.lastReviewedAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

/** Whichever copy was reviewed more recently wins. */
function mostRecent(a: SrsCard | undefined, b: SrsCard | undefined): SrsCard | undefined {
  if (!a) return b;
  if (!b) return a;
  return (b.lastReviewedAt ?? 0) > (a.lastReviewedAt ?? 0) ? b : a;
}

function mergeCaches(base: CardCache, incoming: CardCache): CardCache {
  const merged: CardCache = { ...base };
  for (const [key, card] of Object.entries(incoming)) {
    const winner = mostRecent(merged[key], card);
    if (winner) merged[key] = winner;
  }
  return merged;
}

/**
 * Carry review history from a signed-out session into the account on first
 * authenticated load — the mirror of `pendingGlossaryService`'s word flush.
 */
async function absorbAnonymousProgress(userId: string, cache: CardCache): Promise<CardCache> {
  const anonymous = await readCache(null);
  if (Object.keys(anonymous).length === 0) return cache;

  const merged = mergeCaches(cache, anonymous);
  await AsyncStorage.removeItem(storageKey(null));
  return merged;
}

/**
 * Build the full deck: two cards per glossary word, hydrated with saved
 * scheduling state. Words never reviewed before come back as fresh `new` cards.
 */
export async function loadDeck(
  userId: string | null | undefined,
  words: WordEntry[],
  now: number = Date.now()
): Promise<DeckItem[]> {
  let cache = await readCache(userId);

  if (userId) {
    cache = await absorbAnonymousProgress(userId, cache);

    try {
      const { data, error } = await supabase
        .from('flashcard_srs')
        .select(
          'card_key, state, ease, interval_days, step_index, due_at, reps, lapses, introduced_at, last_reviewed_at'
        )
        .eq('user_id', userId);

      if (error) throw error;

      const remote: CardCache = {};
      for (const row of (data ?? []) as SrsRow[]) {
        remote[row.card_key] = rowToCard(row);
      }

      const local = cache;
      cache = mergeCaches(local, remote);
      await pushUnsyncedCards(userId, local, remote, words);
    } catch {
      // Offline or the table is unreachable — the local cache still works,
      // and the next load retries the push.
    }

    await writeCache(cache, userId);
  }

  const items: DeckItem[] = [];
  for (const word of words) {
    for (const direction of REVIEW_DIRECTIONS) {
      const key = cardKeyFor(word, direction);
      items.push({
        word,
        direction,
        card: cache[key] ?? createCard(key, now),
      });
    }
  }

  return items;
}

/**
 * Re-send reviews that never made it to Supabase.
 *
 * A review graded while offline (or before the `flashcard_srs` table existed)
 * lives only in the local cache. Without this, it would reach the server only
 * if that same card happened to be reviewed again while online. On every
 * authenticated load we push anything the server is missing or behind on.
 */
async function pushUnsyncedCards(
  userId: string,
  local: CardCache,
  remote: CardCache,
  words: WordEntry[]
): Promise<void> {
  const wordByContentKey = new Map(words.map((word) => [wordContentKey(word), word]));

  const outbound = Object.values(local).filter((card) => {
    // Never-reviewed cards carry no state worth a row.
    if (card.lastReviewedAt === null) return false;
    const serverCard = remote[card.key];
    return !serverCard || card.lastReviewedAt > (serverCard.lastReviewedAt ?? 0);
  });

  if (outbound.length === 0) return;

  const rows = outbound
    .map((card) => {
      // Drop the trailing direction segment to recover the word's content key.
      const word = wordByContentKey.get(card.key.replace(/::(k2e|e2k)$/, ''));
      return word ? cardToRow(userId, card, word) : null;
    })
    .filter((row): row is ReturnType<typeof cardToRow> => row !== null);

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('flashcard_srs')
    .upsert(rows, { onConflict: 'user_id,card_key' });

  if (error) throw error;
}

/** Persist one graded card. Local write first, remote sync best-effort. */
export async function saveCardReview(
  userId: string | null | undefined,
  card: SrsCard,
  word: WordEntry
): Promise<void> {
  const cache = await readCache(userId);
  cache[card.key] = card;
  await writeCache(cache, userId);

  if (!userId) return;

  const { error } = await supabase
    .from('flashcard_srs')
    .upsert(cardToRow(userId, card, word), { onConflict: 'user_id,card_key' });

  if (error) throw error;
}

/** Drop all saved scheduling. Used when signing out clears local state. */
export async function clearSrsCache(userId?: string | null): Promise<void> {
  if (userId) {
    await AsyncStorage.removeItem(storageKey(userId));
    return;
  }

  const keys = await AsyncStorage.getAllKeys();
  const srsKeys = keys.filter((key) => key.startsWith(`${STORAGE_KEY_PREFIX}:`));
  if (srsKeys.length > 0) {
    await AsyncStorage.multiRemove(srsKeys);
  }
}
