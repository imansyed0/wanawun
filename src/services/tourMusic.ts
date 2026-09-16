import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Quiet music under Naani's tour. Streamed from the course-audio bucket rather
 * than bundled, so it costs nothing to download the app. It loops, sits well
 * below her word audio, and stops the moment the tour ends.
 */

const TRACK_PATH = 'tour/rum-gaeyam-sheeshas.mp3';

/** Low enough to sit under everything else without drowning it. */
const VOLUME = 0.08;

let player: AudioPlayer | null = null;

function trackUrl(): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/course-audio/${TRACK_PATH}` : null;
}

/** Start the music, if it isn't already playing. Safe to call repeatedly. */
export async function startTourMusic(): Promise<void> {
  if (player) return;
  const url = trackUrl();
  if (!url) return;

  try {
    // Background music shouldn't force itself over a locked/silenced phone.
    await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false });
  } catch {
    // Non-fatal: the mode is a preference, not a requirement.
  }

  try {
    const next = createAudioPlayer({ uri: url }, { updateInterval: 1000 });
    next.loop = true;
    next.volume = VOLUME;
    player = next;
    next.play();
  } catch (error) {
    console.warn('Tour music failed to start:', error);
    player = null;
  }
}

/** Stop and release the music. Safe to call when nothing is playing. */
export function stopTourMusic(): void {
  const current = player;
  player = null;
  if (!current) return;
  try {
    current.pause();
  } catch {}
  try {
    current.remove();
  } catch {}
}

/** True while the tour music is playing; used by tests and debug panels. */
export function isTourMusicPlaying(): boolean {
  return player !== null;
}
