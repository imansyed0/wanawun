import { supabase } from '@/src/lib/supabase';
import type { WordEntry } from '@/src/types';

// Cache words locally after first fetch
let cachedWords: WordEntry[] | null = null;

/** Invalidate cache so next getAllWords() re-fetches */
export function invalidateWordCache() {
  cachedWords = null;
}

export async function getAllWords(): Promise<WordEntry[]> {
  if (cachedWords) return cachedWords;

  const { data, error } = await supabase
    .from('words')
    .select('*')
    .order('kashmiri');

  if (error) throw error;
  cachedWords = data as WordEntry[];
  return cachedWords;
}

function glossaryKey(kashmiri: string, english: string) {
  return `${kashmiri.trim().toLowerCase()}::${english.trim().toLowerCase()}`;
}

/**
 * Fetch the signed-in user's lesson-built glossary only.
 */
export async function getGlossaryWords(userId?: string): Promise<WordEntry[]> {
  if (!userId) {
    return [];
  }

  const { data: lessonRows, error } = await supabase
    .from('lesson_vocab')
    .select('id, kashmiri, english, word_id, words:word_id(audio_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const merged = new Map<string, WordEntry>();

  for (const row of lessonRows ?? []) {
    const linkedWord = Array.isArray(row.words) ? row.words[0] : row.words;
    const key = glossaryKey(row.kashmiri, row.english);
    const existing = merged.get(key);

    if (existing) {
      if (!existing.audio_url && linkedWord?.audio_url) {
        existing.audio_url = linkedWord.audio_url;
      }
      continue;
    }

    const lessonWord: WordEntry = {
      id: row.word_id ?? `lesson-vocab:${row.id}`,
      kashmiri: row.kashmiri,
      english: row.english,
      part_of_speech: 'other',
      category: 'lesson',
      difficulty: 1,
      is_loan_word: false,
      is_phrase: row.kashmiri.includes(' '),
      audio_url: linkedWord?.audio_url ?? null,
    };

    merged.set(lessonWord.id, lessonWord);
    merged.set(key, lessonWord);
  }

  return Array.from(
    new Map(
      Array.from(merged.values()).map((word) => [word.id, word])
    ).values()
  ).sort((a, b) => a.kashmiri.localeCompare(b.kashmiri));
}

export async function deleteGlossaryWord(
  userId: string,
  word: Pick<WordEntry, 'id' | 'kashmiri' | 'english'>
): Promise<void> {
  let query = supabase
    .from('lesson_vocab')
    .delete()
    .eq('user_id', userId);

  if (word.id.startsWith('lesson-vocab:')) {
    query = query.eq('id', word.id.replace('lesson-vocab:', ''));
  } else {
    query = query.or(
      `word_id.eq.${word.id},and(kashmiri.eq.${word.kashmiri},english.eq.${word.english})`
    );
  }

  const { error } = await query;
  if (error) throw error;
}

export async function getWordsByCategory(category: string): Promise<WordEntry[]> {
  const words = await getAllWords();
  return words.filter(w => w.category === category);
}

export async function getWordsByDifficulty(difficulty: 1 | 2 | 3): Promise<WordEntry[]> {
  const words = await getAllWords();
  return words.filter(w => w.difficulty === difficulty);
}

export function getRandomWords(words: WordEntry[], count: number): WordEntry[] {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateMultipleChoiceOptions(
  correctWord: WordEntry,
  allWords: WordEntry[],
  optionCount: number = 4
): string[] {
  // Get wrong options that are different from the correct answer
  const wrongOptions = allWords
    .filter(w => w.id !== correctWord.id && w.english !== correctWord.english)
    .sort(() => Math.random() - 0.5)
    .slice(0, optionCount - 1)
    .map(w => w.english);

  // Insert correct answer at a random position
  const options = [...wrongOptions];
  const correctPosition = Math.floor(Math.random() * optionCount);
  options.splice(correctPosition, 0, correctWord.english);

  return options;
}

export function getWordsBySlotType(
  words: WordEntry[],
  slotType: string
): WordEntry[] {
  switch (slotType) {
    case 'person':
      return words.filter(w => w.category === 'family' || w.english.match(/man|woman|boy|girl|father|mother|brother|sister|child/i));
    case 'place':
      return words.filter(w => w.category === 'places');
    case 'food':
      return words.filter(w => w.category === 'food');
    case 'noun':
      return words.filter(w => w.part_of_speech === 'noun');
    case 'verb':
      return words.filter(w => w.part_of_speech === 'verb');
    case 'adjective':
      return words.filter(w => w.part_of_speech === 'adjective');
    case 'object':
      return words.filter(w => w.part_of_speech === 'noun' && w.category === 'household');
    default:
      return words.filter(w => w.part_of_speech === 'noun');
  }
}
