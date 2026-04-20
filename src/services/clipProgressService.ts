import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';

const STORAGE_KEY_PREFIX = 'listened_clips';

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

async function markClipListenedInCache(
  userId: string | null | undefined,
  courseId: string,
  lessonId: string,
  clipFilename: string
): Promise<void> {
  const data = await getCachedAll(userId);
  const key = lessonKey(courseId, lessonId);
  const clips = data[key] ?? [];
  if (!clips.includes(clipFilename)) {
    data[key] = [...clips, clipFilename];
    await saveCachedAll(data, userId);
  }
}

async function mergeCacheFromRows(userId: string, rows: ClipProgressRow[]): Promise<void> {
  const current = await getCachedAll(userId);
  const next = toCache(rows);
  await saveCachedAll({ ...current, ...next }, userId);
}

export async function clearClipProgressCache(userId?: string | null): Promise<void> {
  if (userId) {
    await AsyncStorage.removeItem(storageKey(userId));
    return;
  }

  const keys = await AsyncStorage.getAllKeys();
  const clipProgressKeys = keys.filter((key) => key.startsWith(`${STORAGE_KEY_PREFIX}:`));
  if (clipProgressKeys.length > 0) {
    await AsyncStorage.multiRemove(clipProgressKeys);
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

/** Check if all clips in a lesson have been listened to */
export async function isLessonFullyListened(
  userId: string | null | undefined,
  courseId: string,
  lessonId: string,
  totalClipFilenames: string[]
): Promise<boolean> {
  if (totalClipFilenames.length === 0) return false;
  const listened = await getListenedClips(userId, courseId, lessonId);
  return totalClipFilenames.every((f) => listened.has(f));
}

/** Get all lesson IDs in a course that have been fully listened to */
export async function getFullyListenedLessonIds(
  userId: string | null | undefined,
  courseId: string,
  lessons: { id: string; audioClips: { filename: string }[] }[]
): Promise<string[]> {
  let data: ListenedClips;

  if (!userId) {
    data = await getCachedAll(null);
  } else {
    try {
      const { data: rows, error } = await supabase
        .from('lesson_clip_progress')
        .select('course_id, lesson_id, clip_filename')
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (error) throw error;

      await mergeCacheFromRows(userId, rows ?? []);
      data = toCache(rows ?? []);
    } catch {
      data = await getCachedAll(userId);
    }
  }

  return lessons
    .filter((lesson) => {
      if (lesson.audioClips.length === 0) return false;
      const listened = new Set(data[lessonKey(courseId, lesson.id)] ?? []);
      return lesson.audioClips.every((clip) => listened.has(clip.filename));
    })
    .map((lesson) => lesson.id);
}
