import { Audio } from 'expo-av';
import { supabase } from '@/src/lib/supabase';
import { Platform } from 'react-native';

let _sound: Audio.Sound | null = null;

/** Play audio from a URL, stopping any currently playing sound */
export async function playAudio(url: string): Promise<void> {
  await stopAudio();
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });
  const { sound } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true }
  );
  _sound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if ('didJustFinish' in status && status.didJustFinish) {
      sound.unloadAsync();
      _sound = null;
    }
  });
}

/** Stop currently playing audio */
export async function stopAudio(): Promise<void> {
  if (_sound) {
    try {
      await _sound.unloadAsync();
    } catch {}
    _sound = null;
  }
}

/** Start recording audio. Returns the Recording object. */
export async function startRecording(): Promise<Audio.Recording> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  return recording;
}

/** Stop recording and upload to Supabase Storage.
 *  Returns the public URL of the uploaded file. */
export async function stopAndUploadRecording(
  recording: Audio.Recording,
  userId: string,
  wordId: string
): Promise<string> {
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = recording.getURI();
  if (!uri) throw new Error('No recording URI');

  const filename = `${userId}/${wordId}.m4a`;

  // Read file and upload
  if (Platform.OS === 'web') {
    // On web, fetch the blob from the URI
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from('recordings')
      .upload(filename, blob, {
        contentType: 'audio/mp4',
        upsert: true,
      });
    if (error) throw error;
  } else {
    // On native, read as base64
    const FileSystem = require('expo-file-system');
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const { error } = await supabase.storage
      .from('recordings')
      .upload(filename, bytes, {
        contentType: 'audio/mp4',
        upsert: true,
      });
    if (error) throw error;
  }

  // Get public URL with cache-busting param so re-recordings aren't cached
  const { data } = supabase.storage.from('recordings').getPublicUrl(filename);
  return `${data.publicUrl}?t=${Date.now()}`;
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
