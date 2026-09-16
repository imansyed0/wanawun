import { dictionaryAudioUrls } from '@/src/lib/englishDictionary';
import { linkAudioToWord } from '@/src/services/audioService';
import type { WordEntry } from '@/src/types';

/**
 * A word tapped in a lesson comes from S. Hassan's dictionary, which has its
 * own recording in course-audio/hassan-dictionary/. Adding such a word keeps
 * that pronunciation, so it can be played straight away.
 *
 * Only that path attaches dictionary audio: words added with the + button are
 * for recording in the learner's own voice, and are left silent until someone
 * does.
 */

/**
 * Link a dictionary recording to a word that hasn't got one. Returns the URL it
 * linked, or null. Never replaces a recording someone made themselves.
 */
export async function attachDictionaryClip(
  word: WordEntry,
  audioId: string
): Promise<string | null> {
  if (word.audio_url || word.id.startsWith('lesson-vocab:')) return null;
  const [url] = dictionaryAudioUrls(audioId);
  if (!url) return null;
  try {
    await linkAudioToWord(word.id, url);
    return url;
  } catch (error) {
    // Not fatal: the word is saved, it just has no pronunciation yet.
    console.warn('Dictionary audio link failed:', word.kashmiri, error);
    return null;
  }
}
