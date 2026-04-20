import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder,
  type AudioStatus,
} from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import { File } from 'expo-file-system';
import { supabase } from '@/src/lib/supabase';
import { Platform } from 'react-native';

let _sound: AudioPlayer | null = null;
let _onAudioFinish: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Verbose playback logging
// ---------------------------------------------------------------------------
// Always on (harmless console output); can be toggled at runtime via
// setAudioVerboseLogging(false). In addition to console.log output, every
// line is appended to an in-memory ring buffer so the in-app debug panel
// can render it on-device — useful on Release builds where Metro/Xcode
// logs are not available to the user.
// ---------------------------------------------------------------------------

let _audioVerbose = true;

const AUDIO_LOG_CAPACITY = 200;
const _audioLog: string[] = [];
const _audioLogListeners = new Set<(log: string[]) => void>();

export function setAudioVerboseLogging(enabled: boolean) {
  _audioVerbose = enabled;
}

export function getRecentAudioLog(): string[] {
  return _audioLog.slice();
}

export function clearAudioLog(): void {
  _audioLog.length = 0;
  _audioLogListeners.forEach((fn) => {
    try {
      fn(_audioLog.slice());
    } catch {}
  });
}

export function subscribeAudioLog(fn: (log: string[]) => void): () => void {
  _audioLogListeners.add(fn);
  try {
    fn(_audioLog.slice());
  } catch {}
  return () => {
    _audioLogListeners.delete(fn);
  };
}

function pushAudioLog(line: string) {
  _audioLog.push(line);
  if (_audioLog.length > AUDIO_LOG_CAPACITY) {
    _audioLog.splice(0, _audioLog.length - AUDIO_LOG_CAPACITY);
  }
  _audioLogListeners.forEach((fn) => {
    try {
      fn(_audioLog.slice());
    } catch {}
  });
}

function formatLogArg(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function tsLog(tag: string, startedAt: number, ...args: unknown[]) {
  if (!_audioVerbose) return;
  const delta = `+${String(Date.now() - startedAt).padStart(5, ' ')}ms`;
  const prefix = `[audio:${tag}] ${delta}`;
  console.log(prefix, ...args);
  pushAudioLog(`${prefix} ${args.map(formatLogArg).join(' ')}`);
}

function summarizeStatus(s: AudioStatus) {
  return {
    isLoaded: s.isLoaded,
    isBuffering: s.isBuffering,
    playing: s.playing,
    playbackState: s.playbackState,
    timeControlStatus: s.timeControlStatus,
    reasonForWaitingToPlay: s.reasonForWaitingToPlay,
    duration: Number.isFinite(s.duration) ? s.duration : null,
    currentTime: Number.isFinite(s.currentTime) ? s.currentTime : null,
    didJustFinish: s.didJustFinish,
    mediaServicesDidReset: s.mediaServicesDidReset,
  };
}

/**
 * Attach verbose diagnostic logging to an AudioPlayer instance.
 *
 * Logs:
 *   - creation (with URL)
 *   - every *change* in (playbackState / timeControlStatus / reason / loaded)
 *   - the first moment the clip reports isLoaded
 *   - a warning if isLoaded never fires within `loadTimeoutMs` (default 10s)
 *
 * Returns a cleanup function that removes the diagnostic listener and
 * cancels the watchdog timer. Safe to call multiple times.
 */
export function attachVerbosePlaybackLogging(
  sound: AudioPlayer,
  url: string,
  tag: string,
  opts?: { loadTimeoutMs?: number }
): () => void {
  const startedAt = Date.now();
  const loadTimeoutMs = opts?.loadTimeoutMs ?? 10000;

  let lastSignature = '';
  let loadedAt: number | null = null;

  tsLog(tag, startedAt, 'createAudioPlayer', { url });

  const subscription = sound.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    const sig = `${status.playbackState}|${status.timeControlStatus}|${status.reasonForWaitingToPlay}|${status.isLoaded}|${status.isBuffering}|${status.playing}`;
    if (sig !== lastSignature) {
      lastSignature = sig;
      tsLog(tag, startedAt, 'status', summarizeStatus(status));
    }
    if (status.isLoaded && loadedAt === null) {
      loadedAt = Date.now();
      tsLog(tag, startedAt, 'LOADED', {
        durationSec: status.duration,
        tookMs: loadedAt - startedAt,
      });
    }
    if (status.didJustFinish) {
      tsLog(tag, startedAt, 'didJustFinish', {
        loadedAfterMs: loadedAt != null ? loadedAt - startedAt : null,
      });
    }
  });

  const watchdog = setTimeout(() => {
    if (loadedAt === null) {
      tsLog(
        tag,
        startedAt,
        `WARNING: clip never reached isLoaded after ${loadTimeoutMs}ms — likely failed to load`,
        { url }
      );
    }
  }, loadTimeoutMs);

  return () => {
    clearTimeout(watchdog);
    try {
      // EventSubscription.remove() is the standard expo-modules API.
      (subscription as unknown as { remove?: () => void })?.remove?.();
    } catch {}
  };
}

const PLAYBACK_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
  interruptionMode: 'doNotMix' as const,
};

const RECORDING_AUDIO_MODE = {
  allowsRecording: true,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
  interruptionMode: 'doNotMix' as const,
};

const NATIVE_RECORDING_OPTIONS =
  Platform.OS === 'web'
    ? RecordingPresets.HIGH_QUALITY
    : {
        extension: '.m4a',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        android: {
          outputFormat: 'mpeg4' as const,
          audioEncoder: 'aac' as const,
        },
        ios: {
          outputFormat: IOSOutputFormat.MPEG4AAC,
          audioQuality: AudioQuality.MAX,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

function guessAudioExtension(uri: string, mimeType?: string | null): string {
  const normalizedMime = mimeType?.toLowerCase() ?? '';
  const uriExtension = uri.split('?')[0]?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

  if (uriExtension) {
    return uriExtension;
  }
  if (normalizedMime.includes('webm')) {
    return 'webm';
  }
  if (normalizedMime.includes('mpeg') || normalizedMime.includes('mp3')) {
    return 'mp3';
  }
  if (
    normalizedMime.includes('mp4') ||
    normalizedMime.includes('m4a') ||
    normalizedMime.includes('aac')
  ) {
    return 'm4a';
  }

  return Platform.OS === 'web' ? 'webm' : 'm4a';
}

function guessAudioContentType(extension: string, mimeType?: string | null): string {
  const normalizedMime = mimeType?.toLowerCase() ?? '';
  if (normalizedMime) {
    return normalizedMime;
  }

  switch (extension) {
    case 'webm':
      return 'audio/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
    case 'm4a':
    case 'mp4':
    default:
      return 'audio/mp4';
  }
}

function detectAudioFormatFromBytes(
  bytes: Uint8Array,
  fallbackExtension: string,
  fallbackMimeType?: string | null
): { extension: string; contentType: string } {
  const hasPrefix = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  const asciiAt = (start: number, end: number) =>
    String.fromCharCode(...Array.from(bytes.slice(start, end)));

  if (bytes.length >= 4 && hasPrefix(0x1a, 0x45, 0xdf, 0xa3)) {
    return { extension: 'webm', contentType: 'audio/webm' };
  }

  if (bytes.length >= 12 && asciiAt(4, 8) === 'ftyp') {
    return { extension: 'm4a', contentType: 'audio/mp4' };
  }

  if (bytes.length >= 3 && asciiAt(0, 3) === 'ID3') {
    return { extension: 'mp3', contentType: 'audio/mpeg' };
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0) {
    return { extension: 'aac', contentType: 'audio/aac' };
  }

  return {
    extension: fallbackExtension,
    contentType: guessAudioContentType(fallbackExtension, fallbackMimeType),
  };
}

/** Play audio from a URL, stopping any currently playing sound */
export async function playAudio(
  url: string,
  options?: { onFinish?: () => void; tag?: string }
): Promise<void> {
  const tag = options?.tag ?? 'playAudio';
  await stopAudio();
  await setAudioModeAsync(PLAYBACK_AUDIO_MODE);

  let sound: AudioPlayer;
  try {
    sound = createAudioPlayer(
      { uri: url },
      {
        updateInterval: 250,
        preferredForwardBufferDuration: 5,
      }
    );
  } catch (err: any) {
    const msg = `[audio:${tag}] createAudioPlayer threw ${formatLogArg({ url, err: err?.message ?? String(err) })}`;
    console.error(msg);
    pushAudioLog(msg);
    throw err;
  }

  _sound = sound;
  _onAudioFinish = options?.onFinish ?? null;

  const detachVerbose = attachVerbosePlaybackLogging(sound, url, tag);

  sound.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      detachVerbose();
      try {
        sound.remove();
      } catch {}
      if (_sound === sound) {
        _sound = null;
      }
      const finish = _onAudioFinish;
      _onAudioFinish = null;
      finish?.();
    }
  });

  try {
    sound.play();
  } catch (err: any) {
    const msg = `[audio:${tag}] sound.play() threw ${formatLogArg({ url, err: err?.message ?? String(err) })}`;
    console.error(msg);
    pushAudioLog(msg);
    detachVerbose();
    throw err;
  }
}

/** Stop currently playing audio */
export async function stopAudio(): Promise<void> {
  if (_sound) {
    try {
      _sound.pause();
      _sound.remove();
    } catch {}
    _sound = null;
  }
  _onAudioFinish = null;
}

/** Start recording audio. Returns the Recording object. */
export async function startRecording(): Promise<AudioRecorder> {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone permission is required to record audio.');
  }

  await setAudioModeAsync(RECORDING_AUDIO_MODE);
  const recording = new AudioModule.AudioRecorder(NATIVE_RECORDING_OPTIONS) as AudioRecorder;
  await recording.prepareToRecordAsync();
  recording.record();
  return recording;
}

/** Stop recording and upload to Supabase Storage.
 *  Returns the public URL of the uploaded file. */
export async function stopAndUploadRecording(
  recording: AudioRecorder,
  userId: string,
  wordId: string
): Promise<string> {
  let filename = `${userId}/${wordId}.${Platform.OS === 'web' ? 'webm' : 'm4a'}`;

  try {
    await recording.stop();

    const uri = recording.uri;
    if (!uri) {
      throw new Error('No recording URI');
    }

    let uploadBody: Blob | ArrayBuffer;
    let contentType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to read recording blob (${response.status})`);
      }
      uploadBody = await response.blob();
      if (!uploadBody.size) {
        throw new Error('Recorded web audio blob is empty.');
      }
      const extension = guessAudioExtension(uri, uploadBody.type);
      filename = `${userId}/${wordId}.${extension}`;
      contentType = guessAudioContentType(extension, uploadBody.type);
    } else {
      const nativeFile = new File(uri);
      if (!nativeFile.exists) {
        throw new Error(`Recorded file not found at ${uri}`);
      }
      const bytes = await nativeFile.bytes();
      if (!bytes.length) {
        throw new Error(`Recorded native audio file is empty at ${uri}`);
      }

      const fallbackExtension = guessAudioExtension(uri, nativeFile.type);
      const detectedFormat = detectAudioFormatFromBytes(bytes, fallbackExtension, nativeFile.type);
      filename = `${userId}/${wordId}.${detectedFormat.extension}`;
      contentType = detectedFormat.contentType;
      uploadBody = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
    }

    const { error } = await supabase.storage
      .from('recordings')
      .upload(filename, uploadBody, {
        contentType,
        upsert: true,
      });
    if (error) throw error;

    // Get public URL with cache-busting param so re-recordings aren't cached
    const { data } = supabase.storage.from('recordings').getPublicUrl(filename);
    return `${data.publicUrl}?t=${Date.now()}`;
  } finally {
    await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
    try {
      (recording as AudioRecorder & { remove?: () => void }).remove?.();
    } catch {}
  }
}

/** Save the audio URL to the word in the database */
export async function linkAudioToWord(
  wordId: string,
  audioUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .update({ audio_url: audioUrl })
    .eq('id', wordId);
  if (error) throw error;
}
