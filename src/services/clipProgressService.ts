import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'listened_clips';

type ListenedClips = Record<string, string[]>; // { "courseId:lessonId": ["clip1.mp3", "clip2.mp3"] }

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

async function getAll(): Promise<ListenedClips> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveAll(data: ListenedClips): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Mark a clip as listened for a lesson */
export async function markClipListened(
  courseId: string,
  lessonId: string,
  clipFilename: string
): Promise<void> {
  const data = await getAll();
  const key = lessonKey(courseId, lessonId);
  const clips = data[key] ?? [];
  if (!clips.includes(clipFilename)) {
    data[key] = [...clips, clipFilename];
    await saveAll(data);
  }
}

/** Get the set of listened clip filenames for a lesson */
export async function getListenedClips(
  courseId: string,
  lessonId: string
): Promise<Set<string>> {
  const data = await getAll();
  return new Set(data[lessonKey(courseId, lessonId)] ?? []);
}

/** Check if all clips in a lesson have been listened to */
export async function isLessonFullyListened(
  courseId: string,
  lessonId: string,
  totalClipFilenames: string[]
): Promise<boolean> {
  if (totalClipFilenames.length === 0) return false;
  const listened = await getListenedClips(courseId, lessonId);
  return totalClipFilenames.every((f) => listened.has(f));
}

/** Get all lesson IDs in a course that have been fully listened to */
export async function getFullyListenedLessonIds(
  courseId: string,
  lessons: { id: string; audioClips: { filename: string }[] }[]
): Promise<string[]> {
  const data = await getAll();
  return lessons.filter((lesson) => {
    if (lesson.audioClips.length === 0) return false;
    const listened = new Set(data[lessonKey(courseId, lesson.id)] ?? []);
    return lesson.audioClips.every((clip) => listened.has(clip.filename));
  }).map((l) => l.id);
}
