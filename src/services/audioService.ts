import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder,
} from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import { File } from 'expo-file-system';
import { supabase } from '@/src/lib/supabase';
import { Platform } from 'react-native';

let _sound: AudioPlayer | null = null;
let _onAudioFinish: (() => void) | null = null;

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
  options?: { onFinish?: () => void }
): Promise<void> {
  await stopAudio();
  await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
  const sound = createAudioPlayer(
    { uri: url },
    {
      updateInterval: 250,
      preferredForwardBufferDuration: 5,
    }
  );
  _sound = sound;
  _onAudioFinish = options?.onFinish ?? null;
  sound.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
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
  sound.play();
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
