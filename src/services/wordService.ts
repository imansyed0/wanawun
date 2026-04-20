import { supabase } from '@/src/lib/supabase';
import type { WordEntry } from '@/src/types';

// Cache words locally after first fetch
let cachedWords: WordEntry[] | null = null;
const MANUAL_GLOSSARY_LESSON_ID = 'manual-glossary';
const MANUAL_GLOSSARY_COURSE_ID = 'glossary';

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

function mapGlossaryRowToWordEntry(row: any): WordEntry {
  const linkedWord = Array.isArray(row.words) ? row.words[0] : row.words;

  return {
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

    const lessonWord = mapGlossaryRowToWordEntry(row);

    merged.set(lessonWord.id, lessonWord);
    merged.set(key, lessonWord);
  }

  return Array.from(
    new Map(
      Array.from(merged.values()).map((word) => [word.id, word])
    ).values()
  ).sort((a, b) => a.kashmiri.localeCompare(b.kashmiri));
}

export async function addGlossaryWord(
  userId: string,
  kashmiri: string,
  english: string
): Promise<WordEntry> {
  const trimmedKashmiri = kashmiri.trim();
  const trimmedEnglish = english.trim();

  if (!trimmedKashmiri || !trimmedEnglish) {
    throw new Error('Both Kashmiri and English are required.');
  }

  const { data: existingGlossaryRow, error: existingGlossaryError } = await supabase
    .from('lesson_vocab')
    .select('id, kashmiri, english, word_id, words:word_id(audio_url)')
    .eq('user_id', userId)
    .ilike('kashmiri', trimmedKashmiri)
    .ilike('english', trimmedEnglish)
    .limit(1)
    .maybeSingle();

  if (existingGlossaryError) throw existingGlossaryError;
  if (existingGlossaryRow) {
    return mapGlossaryRowToWordEntry(existingGlossaryRow);
  }

  const { data: existingWord, error: existingWordError } = await supabase
    .from('words')
    .select('id, audio_url')
    .ilike('kashmiri', trimmedKashmiri)
    .ilike('english', trimmedEnglish)
    .limit(1)
    .maybeSingle();

  if (existingWordError) throw existingWordError;

  let wordId = existingWord?.id ?? null;
  let audioUrl = existingWord?.audio_url ?? null;

  if (!wordId) {
    const { data: insertedWord, error: insertWordError } = await supabase
      .from('words')
      .insert({
        kashmiri: trimmedKashmiri,
        english: trimmedEnglish,
        part_of_speech: 'other',
        category: 'lesson',
        difficulty: 1,
        is_loan_word: false,
        is_phrase: trimmedKashmiri.includes(' '),
      })
      .select('id, audio_url')
      .single();

    if (insertWordError) throw insertWordError;
    wordId = insertedWord.id;
    audioUrl = insertedWord.audio_url ?? null;
  }

  const { data: insertedGlossaryRow, error: insertGlossaryError } = await supabase
    .from('lesson_vocab')
    .insert({
      user_id: userId,
      lesson_id: MANUAL_GLOSSARY_LESSON_ID,
      course_id: MANUAL_GLOSSARY_COURSE_ID,
      kashmiri: trimmedKashmiri,
      english: trimmedEnglish,
      word_id: wordId,
    })
    .select('id, kashmiri, english, word_id')
    .single();

  if (insertGlossaryError) throw insertGlossaryError;

  return {
    ...mapGlossaryRowToWordEntry(insertedGlossaryRow),
    audio_url: audioUrl,
  };
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
