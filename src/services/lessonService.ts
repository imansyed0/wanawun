import { supabase } from '@/src/lib/supabase';

export interface LessonVocabEntry {
  id: string;
  lesson_id: string;
  course_id: string;
  kashmiri: string;
  english: string;
  word_id: string | null;
  audio_url: string | null;
  created_at: string;
}

/** Fetch all vocab entries for a lesson */
export async function getLessonVocab(
  userId: string,
  lessonId: string
): Promise<LessonVocabEntry[]> {
  const { data, error } = await supabase
    .from('lesson_vocab')
    .select('*, words:word_id(audio_url)')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  // Flatten the joined audio_url onto the entry
  return (data ?? []).map((row: any) => ({
    ...row,
    audio_url: row.words?.audio_url ?? null,
    words: undefined,
  }));
}

/** Add a vocab entry and sync it to the main glossary (words table) */
export async function addLessonVocab(
  userId: string,
  lessonId: string,
  courseId: string,
  kashmiri: string,
  english: string
): Promise<LessonVocabEntry> {
  // 1. Check if word already exists in glossary
  const { data: existing } = await supabase
    .from('words')
    .select('id')
    .ilike('kashmiri', kashmiri.trim())
    .ilike('english', english.trim())
    .limit(1)
    .single();

  let wordId: string | null = existing?.id ?? null;

  // 2. If not in glossary, insert it
  if (!wordId) {
    const { data: newWord, error: wordErr } = await supabase
      .from('words')
      .insert({
        kashmiri: kashmiri.trim(),
        english: english.trim(),
        part_of_speech: 'other',
        category: 'lesson',
        difficulty: 1,
        is_loan_word: false,
        is_phrase: kashmiri.trim().includes(' '),
      })
      .select('id')
      .single();
    if (wordErr) console.error('Failed to sync to glossary:', wordErr.message);
    else wordId = newWord?.id ?? null;
  }

  // 3. Insert into lesson_vocab
  const { data, error } = await supabase
    .from('lesson_vocab')
    .insert({
      user_id: userId,
      lesson_id: lessonId,
      course_id: courseId,
      kashmiri: kashmiri.trim(),
      english: english.trim(),
      word_id: wordId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/** Delete a vocab entry */
export async function deleteLessonVocab(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_vocab').delete().eq('id', id);
  if (error) throw error;
}
