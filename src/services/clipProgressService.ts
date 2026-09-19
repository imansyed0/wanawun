import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import { getCompletedLessonIds } from './lessonService';
import { getPendingWordEntries } from './pendingGlossaryService';

const STORAGE_KEY_PREFIX = 'listened_clips';
const WORDS_KEY_PREFIX = 'lessons_with_words';

type ListenedClips = Record<string, string[]>;

type ClipProgressRow = {
  course_id: string;
  lesson_id: string;
  clip_filename: string;
};

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function storageKey(userId?: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : `${STORAGE_KEY_PREFIX}:anonymous`;
}

function wordsStorageKey(userId: string, courseId: string): string {
  return `${WORDS_KEY_PREFIX}:${userId}:${courseId}`;
}

function toCache(rows: ClipProgressRow[]): ListenedClips {
  return rows.reduce<ListenedClips>((acc, row) => {
    const key = lessonKey(row.course_id, row.lesson_id);
    const clips = acc[key] ?? [];
    if (!clips.includes(row.clip_filename)) {
      acc[key] = [...clips, row.clip_filename];
    }
    return acc;
  }, {});
}

async function getCachedAll(userId?: string | null): Promise<ListenedClips> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  return raw ? JSON.parse(raw) : {};
}

async function saveCachedAll(data: ListenedClips, userId?: string | null): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(data));
}

/**
 * Updates to the cache run one at a time. Every one of them reads the whole
 * cache, changes a corner of it and writes it back, so two courses loading at
 * once would otherwise each save what they read and the slower write would
 * drop the other's lessons.
 */
let cacheQueue: Promise<unknown> = Promise.resolve();

function queueCacheUpdate<T>(update: () => Promise<T>): Promise<T> {
  const next = cacheQueue.then(update, update);
  // Keep the chain going whatever happens to this link.
  cacheQueue = next.catch(() => {});
  return next;
}

async function markClipListenedInCache(
  userId: string | null | undefined,
  courseId: string,
  lessonId: string,
  clipFilename: string
): Promise<void> {
  return queueCacheUpdate(async () => {
    const data = await getCachedAll(userId);
    const key = lessonKey(courseId, lessonId);
    const clips = data[key] ?? [];
    if (!clips.includes(clipFilename)) {
      data[key] = [...clips, clipFilename];
      await saveCachedAll(data, userId);
    }
  });
}

async function mergeCacheFromRows(userId: string, rows: ClipProgressRow[]): Promise<void> {
  return queueCacheUpdate(async () => {
    const current = await getCachedAll(userId);
    const next = toCache(rows);
    await saveCachedAll({ ...current, ...next }, userId);
  });
}

export async function clearClipProgressCache(userId?: string | null): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const prefixes = userId
    ? [`${STORAGE_KEY_PREFIX}:${userId}`, `${WORDS_KEY_PREFIX}:${userId}:`]
    : [`${STORAGE_KEY_PREFIX}:`, `${WORDS_KEY_PREFIX}:`];
  const stale = keys.filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));
  if (stale.length > 0) {
    await AsyncStorage.multiRemove(stale);
  }
}

/** Mark a clip as listened for a lesson */
export async function markClipListened(
  userId: string | null | undefined,
  courseId: string,
  lessonId: string,
  clipFilename: string
): Promise<void> {
  await markClipListenedInCache(userId, courseId, lessonId, clipFilename);

  if (!userId) return;

  const { error } = await supabase
    .from('lesson_clip_progress')
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        lesson_id: lessonId,
        clip_filename: clipFilename,
        completed_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,course_id,lesson_id,clip_filename',
        ignoreDuplicates: false,
      }
    );

  if (error) {
    throw error;
  }
}

/** Get the set of listened clip filenames for a lesson */
export async function getListenedClips(
  userId: string | null | undefined,
  courseId: string,
  lessonId: string
): Promise<Set<string>> {
  if (!userId) {
    const data = await getCachedAll(null);
    return new Set(data[lessonKey(courseId, lessonId)] ?? []);
  }

  try {
    const { data, error } = await supabase
      .from('lesson_clip_progress')
      .select('course_id, lesson_id, clip_filename')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('lesson_id', lessonId);

    if (error) throw error;

    await mergeCacheFromRows(userId, data ?? []);
    return new Set((data ?? []).map((row) => row.clip_filename));
  } catch {
    const cached = await getCachedAll(userId);
    return new Set(cached[lessonKey(courseId, lessonId)] ?? []);
  }
}

/** Every clip listened to in a course, keyed the same way as the cache. */
async function getListenedInCourse(
  userId: string | null | undefined,
  courseId: string
): Promise<ListenedClips> {
  if (!userId) return getCachedAll(null);

  try {
    const { data: rows, error } = await supabase
      .from('lesson_clip_progress')
      .select('course_id, lesson_id, clip_filename')
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (error) throw error;

    await mergeCacheFromRows(userId, rows ?? []);
    return toCache(rows ?? []);
  } catch {
    return getCachedAll(userId);
  }
}

/**
 * Which lessons in a course have a word saved from them. One query for the
 * whole course, cached so the ticks survive a trip offline.
 *
 * Signed out there is no lesson_vocab to read — words go to the local pending
 * glossary, which isn't tied to a lesson — so any word stashed there counts.
 */
async function getLessonsWithWords(
  userId: string | null | undefined,
  courseId: string
): Promise<(lessonId: string) => boolean> {
  if (!userId) {
    const pending = await getPendingWordEntries().catch(() => []);
    const hasAny = pending.length > 0;
    return () => hasAny;
  }

  const key = wordsStorageKey(userId, courseId);
  let lessonIds: string[];
  try {
    lessonIds = await getCompletedLessonIds(userId, courseId);
    await AsyncStorage.setItem(key, JSON.stringify(lessonIds));
  } catch {
    const raw = await AsyncStorage.getItem(key);
    lessonIds = raw ? JSON.parse(raw) : [];
  }

  const withWords = new Set(lessonIds);
  return (lessonId) => withWords.has(lessonId);
}

/**
 * Lesson IDs in a course that count as done: the learner played some of its
 * audio and kept at least one word from it. Listening on its own slides off, so
 * the tick waits for the word — the same one word Naani asks for on the way out.
 */
export async function getStartedLessonIds(
  userId: string | null | undefined,
  courseId: string,
  lessons: { id: string; audioClips: { filename: string }[] }[]
): Promise<string[]> {
  const [listenedInCourse, hasWords] = await Promise.all([
    getListenedInCourse(userId, courseId),
    getLessonsWithWords(userId, courseId),
  ]);

  return lessons
    .filter((lesson) => {
      if (lesson.audioClips.length === 0) return false;
      if (!hasWords(lesson.id)) return false;
      const listened = new Set(listenedInCourse[lessonKey(courseId, lesson.id)] ?? []);
      return lesson.audioClips.some((clip) => listened.has(clip.filename));
    })
    .map((lesson) => lesson.id);
}
