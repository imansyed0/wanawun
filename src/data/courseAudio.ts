// Course clips were originally streamed straight from koshur.org. Clips we have
// a copy of now live in the `course-audio` Supabase Storage bucket under the
// same path, listed in the manifest written by scripts/uploadCourseAudio.js.
// Anything not in the manifest keeps using the koshur.org URL.

const KOSHUR_ORIGIN = 'https://koshur.org/';

const manifest = new Set<string>(require('../../data/course_audio_manifest.json') as string[]);

const bucketBaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-audio/`
  : null;

export function resolveCourseAudioUrl(url: string): string {
  if (!bucketBaseUrl || !url.startsWith(KOSHUR_ORIGIN)) return url;
  const key = url.slice(KOSHUR_ORIGIN.length);
  return manifest.has(key) ? bucketBaseUrl + key : url;
}
