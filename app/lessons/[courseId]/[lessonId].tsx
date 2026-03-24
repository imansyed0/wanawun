import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { allCourses, type AudioClip } from '@/src/data/courses';
import { getSpokenKashmiriChapterContent } from '@/src/data/spokenKashmiriContent';
import { ExternalLink } from '@/components/ExternalLink';
import { useAuth } from '@/src/hooks/useAuth';
import {
  getLessonVocab,
  addLessonVocab,
  deleteLessonVocab,
  type LessonVocabEntry,
} from '@/src/services/lessonService';
import {
  playAudio,
  stopAudio,
  startRecording as startAudioRecording,
  stopAndUploadRecording,
  linkAudioToWord,
} from '@/src/services/audioService';
import { invalidateWordCache } from '@/src/services/wordService';

export default function LessonPlayerScreen() {
  const { courseId, lessonId } = useLocalSearchParams<{
    courseId: string;
    lessonId: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();

  const course = allCourses.find((c) => c.id === courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  const spokenContent =
    course?.id === 'spoken-kashmiri' && lesson
      ? getSpokenKashmiriChapterContent(lesson.number)
      : null;
  const lessonImageBaseUrl = lesson?.imageBaseUrl;

  useLayoutEffect(() => {
    if (!course || !lesson) return;

    navigation.setOptions({
      title: lesson.title,
      headerTitle: () =>
        lesson.pageUrl ? (
          <ExternalLink href={lesson.pageUrl} style={styles.headerLink}>
            <Text style={styles.headerLinkText}>{lesson.title}</Text>
          </ExternalLink>
        ) : (
          <Text style={styles.headerLinkText}>{lesson.title}</Text>
        ),
    });
  }, [course, lesson, navigation]);

  // Audio
  const soundRef = useRef<Audio.Sound | null>(null);
  const [currentClipIdx, setCurrentClipIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'vocab'>('content');
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});

  // Vocab
  const [vocab, setVocab] = useState<LessonVocabEntry[]>([]);
  const [newKashmiri, setNewKashmiri] = useState('');
  const [newEnglish, setNewEnglish] = useState('');
  const [saving, setSaving] = useState(false);
  const [vocabError, setVocabError] = useState('');

  // Vocab recording
  const [vocabPlayingId, setVocabPlayingId] = useState<string | null>(null);
  const [vocabRecordingId, setVocabRecordingId] = useState<string | null>(null);
  const [vocabSavingId, setVocabSavingId] = useState<string | null>(null);
  const vocabRecordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    if (!user?.id || !lessonId) return;
    getLessonVocab(user.id, lessonId).then(setVocab).catch(console.error);
  }, [user?.id, lessonId]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (!spokenContent || !lessonImageBaseUrl) return;

    const pending = spokenContent.exchanges.filter(
      (exchange) => imageAspectRatios[exchange.image] == null
    );

    if (pending.length === 0) return;

    pending.forEach((exchange) => {
      const uri = lessonImageBaseUrl + exchange.image;
      Image.getSize(
        uri,
        (width, height) => {
          if (!width || !height) return;
          setImageAspectRatios((current) => {
            if (current[exchange.image] != null) return current;
            return { ...current, [exchange.image]: width / height };
          });
        },
        () => {}
      );
    });
  }, [spokenContent, lessonImageBaseUrl, imageAspectRatios]);

  if (!course || !lesson) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Lesson not found</Text>
      </SafeAreaView>
    );
  }

  const clips = lesson.audioClips;
  const currentClip = clips[currentClipIdx];

  const onPlaybackStatusUpdate = (status: any) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis || 0);
    setDuration(status.durationMillis || 0);
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setIsPlaying(false);
      // Auto-advance to next clip
      if (currentClipIdx < clips.length - 1) {
        playClip(currentClipIdx + 1);
      }
    }
  };

  const playClip = async (idx: number) => {
    setError('');
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setCurrentClipIdx(idx);
      setIsLoading(true);
      setPosition(0);
      setDuration(0);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const uri = lesson.audioBaseUrl + clips[idx].filename;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e: any) {
      setError('Failed to load audio');
      console.error('Audio error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) {
      playClip(currentClipIdx);
      return;
    }
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      playClip(currentClipIdx);
      return;
    }
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const seekBy = async (ms: number) => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;
    const newPos = Math.max(
      0,
      Math.min(status.positionMillis + ms, status.durationMillis || 0)
    );
    await soundRef.current.setPositionAsync(newPos);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const handleVocabPlay = async (entry: LessonVocabEntry) => {
    if (!entry.audio_url) return;
    if (vocabPlayingId === entry.id) {
      await stopAudio();
      setVocabPlayingId(null);
      return;
    }
    setVocabPlayingId(entry.id);
    try {
      await playAudio(entry.audio_url);
    } catch (e) {
      console.error('Vocab playback error:', e);
    }
    setVocabPlayingId(null);
  };

  const handleVocabRecord = async (entry: LessonVocabEntry) => {
    if (!user?.id || !entry.word_id) return;

    // If already recording this entry, stop and save
    if (vocabRecordingId === entry.id && vocabRecordingRef.current) {
      setVocabSavingId(entry.id);
      try {
        const url = await stopAndUploadRecording(vocabRecordingRef.current, user.id, entry.word_id);
        await linkAudioToWord(entry.word_id, url);
        invalidateWordCache();
        // Update local vocab state with new audio URL
        setVocab((prev) =>
          prev.map((v) => (v.id === entry.id ? { ...v, audio_url: url } : v))
        );
      } catch (e: any) {
        console.error('Vocab recording save error:', e);
      } finally {
        vocabRecordingRef.current = null;
        setVocabRecordingId(null);
        setVocabSavingId(null);
      }
      return;
    }

    // Start recording
    try {
      if (vocabRecordingRef.current) {
        await vocabRecordingRef.current.stopAndUnloadAsync();
        vocabRecordingRef.current = null;
      }
      const recording = await startAudioRecording();
      vocabRecordingRef.current = recording;
      setVocabRecordingId(entry.id);
    } catch (e: any) {
      console.error('Vocab recording start error:', e);
      setVocabRecordingId(null);
    }
  };

  const handleAddVocab = async () => {
    const k = newKashmiri.trim();
    const e = newEnglish.trim();
    if (!k || !e) {
      setVocabError('Enter both Kashmiri and English before adding a word.');
      return;
    }
    if (!user?.id) {
      setVocabError('Sign in to save lesson vocab.');
      return;
    }
    if (!lessonId || !courseId) {
      setVocabError('This lesson could not be identified. Reload and try again.');
      return;
    }

    setVocabError('');
    setSaving(true);
    try {
      const entry = await addLessonVocab(user.id, lessonId, courseId, k, e);
      setVocab((prev) => [...prev, entry]);
      setNewKashmiri('');
      setNewEnglish('');
    } catch (err: any) {
      setVocabError('Failed to save vocab');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVocab = async (entry: LessonVocabEntry) => {
    await deleteLessonVocab(entry.id);
    setVocab((prev) => prev.filter((v) => v.id !== entry.id));
  };

  const progress = duration > 0 ? position / duration : 0;
  const spokenIntro =
    spokenContent?.intro && !spokenContent.intro.includes('.mp3')
      ? spokenContent.intro
      : '';
  const hasImages = lesson.images && lesson.images.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'\u2190'}</Text>
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.lessonTitle} numberOfLines={1}>
              {lesson.title}
            </Text>
            <Text style={styles.courseLabel}>{course.title}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          {/* Audio Player */}
          <View style={styles.playerCard}>
            {/* Clip selector for multi-clip lessons */}
            {clips.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.clipScroll}
                contentContainerStyle={styles.clipRow}
              >
                {clips.map((clip, idx) => (
                  <Pressable
                    key={clip.filename}
                    style={[
                      styles.clipChip,
                      idx === currentClipIdx && styles.clipChipActive,
                    ]}
                    onPress={() => playClip(idx)}
                  >
                    <Text
                      style={[
                        styles.clipChipText,
                        idx === currentClipIdx && styles.clipChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {clip.label || clip.filename.replace('.mp3', '')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>
                {clips.length > 1
                  ? `Clip ${currentClipIdx + 1}/${clips.length}`
                  : ''}
              </Text>
              <Text style={styles.timeText}>
                {duration > 0 ? formatTime(duration) : '--:--'}
              </Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              {clips.length > 1 ? (
                <>
                  <Pressable
                    onPress={() => { if (currentClipIdx > 0) playClip(currentClipIdx - 1); }}
                    style={styles.seekBtn}
                    disabled={currentClipIdx === 0}
                  >
                    <Text style={[styles.seekText, currentClipIdx === 0 && { color: Colors.border }]}>{'\u23EE'}</Text>
                  </Pressable>
                  <Pressable onPress={togglePlayPause} style={[styles.playBtn, isLoading && styles.playBtnLoading]} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.playIcon}>{isPlaying ? '\u23F8' : '\u25B6'}</Text>}
                  </Pressable>
                  <Pressable
                    onPress={() => { if (currentClipIdx < clips.length - 1) playClip(currentClipIdx + 1); }}
                    style={styles.seekBtn}
                    disabled={currentClipIdx === clips.length - 1}
                  >
                    <Text style={[styles.seekText, currentClipIdx === clips.length - 1 && { color: Colors.border }]}>{'\u23ED'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => seekBy(-15000)} style={styles.seekBtn}>
                    <Text style={styles.seekText}>-15s</Text>
                  </Pressable>
                  <Pressable onPress={togglePlayPause} style={[styles.playBtn, isLoading && styles.playBtnLoading]} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.playIcon}>{isPlaying ? '\u23F8' : '\u25B6'}</Text>}
                  </Pressable>
                  <Pressable onPress={() => seekBy(15000)} style={styles.seekBtn}>
                    <Text style={styles.seekText}>+15s</Text>
                  </Pressable>
                </>
              )}
            </View>
            {error ? <Text style={styles.audioError}>{error}</Text> : null}
          </View>

          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab('content')}
              style={[styles.tabButton, activeTab === 'content' && styles.tabButtonActive]}
            >
              <Text
                style={[styles.tabButtonText, activeTab === 'content' && styles.tabButtonTextActive]}
              >
                Lesson Content
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('vocab')}
              style={[styles.tabButton, activeTab === 'vocab' && styles.tabButtonActive]}
            >
              <Text
                style={[styles.tabButtonText, activeTab === 'vocab' && styles.tabButtonTextActive]}
              >
                Add Words & Phrases ({vocab.length})
              </Text>
            </Pressable>
          </View>

          {activeTab === 'content' ? (
            <>
              {/* Structured page content for Spoken Kashmiri */}
              {spokenContent && (spokenIntro || spokenContent.exchanges.length > 0) && (
                <View style={styles.imagesSection}>
                  <Text style={styles.sectionTitle}>Lesson Content</Text>
                  {spokenIntro ? (
                    <Text style={styles.translationIntro}>{spokenIntro}</Text>
                  ) : null}
                  {spokenContent.exchanges.map((exchange) => {
                    const imageUri = lesson.imageBaseUrl
                      ? lesson.imageBaseUrl + exchange.image
                      : undefined;
                    const imageAspectRatio = imageAspectRatios[exchange.image];

                    return (
                      <View key={`${exchange.audio}-${exchange.image}`} style={styles.translationCard}>
                        {imageUri ? (
                          <View
                            style={[
                              styles.translationImageFrame,
                              imageAspectRatio
                                ? { aspectRatio: imageAspectRatio, height: undefined }
                                : null,
                            ]}
                          >
                            <Image
                              source={{ uri: imageUri }}
                              style={styles.translationImage}
                              resizeMode="contain"
                            />
                          </View>
                        ) : null}
                        <View style={styles.translationCopy}>
                          {exchange.speaker ? (
                            <Text style={styles.translationSpeaker}>{exchange.speaker}</Text>
                          ) : null}
                          <Text style={styles.translationEnglish}>{exchange.english}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Image-only course content */}
              {hasImages && !spokenContent && (
                <View style={styles.imagesSection}>
                  <Text style={styles.sectionTitle}>Lesson Content</Text>
                  {lesson.images!.map((img) => (
                    <Image
                      key={img.filename}
                      source={{ uri: lesson.imageBaseUrl + img.filename }}
                      style={styles.lessonImage}
                      resizeMode="contain"
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.vocabSection}>
              <Text style={styles.sectionTitle}>
                Words & Phrases ({vocab.length})
              </Text>
              <Text style={styles.vocabHint}>
                Add words you hear — they sync to the glossary
              </Text>
              {!user?.id ? (
                <Text style={styles.vocabWarning}>
                  Sign in to add words from lessons.
                </Text>
              ) : null}
              <View style={styles.audioGuideCard}>
                <Text style={styles.audioGuideTitle}>Record lesson audio</Text>
                <Text style={styles.audioGuideText}>
                  1. Add the vocab word above.
                </Text>
                <Text style={styles.audioGuideText}>
                  2. Wait for the green checkmark to appear.
                </Text>
                <Text style={styles.audioGuideText}>
                  3. Tap Record, then tap Stop to upload the audio to the glossary.
                </Text>
              </View>

              {vocabRecordingId && (
                <View style={styles.recordingBanner}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>
                    Recording... tap Stop on the matching word to upload it.
                  </Text>
                </View>
              )}

              <View style={styles.addRow}>
                <TextInput
                  style={[styles.vocabInput, { flex: 1.2 }]}
                  placeholder="Kashmiri"
                  placeholderTextColor={Colors.textLight}
                  value={newKashmiri}
                  onChangeText={setNewKashmiri}
                />
                <TextInput
                  style={[styles.vocabInput, { flex: 1 }]}
                  placeholder="English"
                  placeholderTextColor={Colors.textLight}
                  value={newEnglish}
                  onChangeText={setNewEnglish}
                />
                <Pressable
                  style={[
                    styles.addBtn,
                    (!newKashmiri.trim() || !newEnglish.trim() || !user?.id) &&
                      styles.addBtnDisabled,
                  ]}
                  onPress={handleAddVocab}
                  disabled={
                    !newKashmiri.trim() || !newEnglish.trim() || saving || !user?.id
                  }
                >
                  <Text style={styles.addBtnText}>
                    {saving ? '...' : '+'}
                  </Text>
                </Pressable>
              </View>

              {vocabError ? (
                <Text style={styles.vocabError}>{vocabError}</Text>
              ) : null}

              {vocab.length === 0 ? (
                <Text style={styles.emptyVocab}>
                  No words added yet. Listen and add words you learn!
                </Text>
              ) : (
                vocab.map((item) => {
                  const isItemPlaying = vocabPlayingId === item.id;
                  const isItemRecording = vocabRecordingId === item.id;
                  const isItemSaving = vocabSavingId === item.id;
                  const hasItemAudio = !!item.audio_url;

                  return (
                    <View key={item.id} style={styles.vocabRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vocabKashmiri}>{item.kashmiri}</Text>
                        <Text style={styles.vocabEnglish}>{item.english}</Text>
                      </View>
                      <View style={styles.vocabActions}>
                        {item.word_id && (
                          <View style={styles.syncBadge}>
                            <Text style={styles.syncBadgeText}>{'\u2713'}</Text>
                          </View>
                        )}
                        {hasItemAudio && (
                          <Pressable
                            style={[styles.vocabAudioBtn, isItemPlaying && styles.vocabAudioBtnActive]}
                            onPress={() => handleVocabPlay(item)}
                          >
                            <Text style={[styles.vocabAudioIcon, isItemPlaying && styles.vocabAudioIconActive]}>
                              {isItemPlaying ? '\u23F9' : '\u25B6'}
                            </Text>
                          </Pressable>
                        )}
                        {item.word_id && (
                          isItemSaving ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : (
                            <Pressable
                              style={[
                                styles.vocabAudioBtn,
                                styles.vocabRecordBtn,
                                isItemRecording && styles.vocabRecordBtnActive,
                              ]}
                              onPress={() => handleVocabRecord(item)}
                            >
                              <Text
                                style={[
                                  styles.vocabRecordIcon,
                                  isItemRecording && styles.vocabRecordIconActive,
                                ]}
                              >
                                {isItemRecording ? 'Stop' : 'Record'}
                              </Text>
                            </Pressable>
                          )
                        )}
                        <Pressable
                          onPress={() => handleDeleteVocab(item)}
                          style={styles.deleteBtn}
                        >
                          <Text style={styles.deleteBtnText}>{'\u00D7'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  backBtn: { padding: Spacing.xs },
  backText: { fontSize: 24, color: Colors.primary },
  headerInfo: { flex: 1 },
  lessonTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  courseLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  headerLink: {
    maxWidth: 240,
  },
  headerLinkText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  scrollContent: { paddingBottom: Spacing.xxl },

  // Player
  playerCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  clipScroll: { marginBottom: Spacing.md },
  clipRow: { gap: Spacing.xs },
  clipChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
    maxWidth: 100,
  },
  clipChipActive: { backgroundColor: Colors.primary },
  clipChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  clipChipTextActive: { color: '#fff', fontWeight: '700' },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  seekBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  seekText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600' },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnLoading: { backgroundColor: Colors.textLight },
  playIcon: { fontSize: 22, color: '#fff' },
  audioError: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xs,
    color: Colors.wrong,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: '#dfe9e3',
    borderRadius: BorderRadius.lg,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#c6d7cd',
  },
  tabButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  tabButtonText: {
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tabButtonTextActive: {
    color: Colors.primary,
    fontWeight: '900',
  },

  // Images
  imagesSection: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  lessonImage: {
    width: '100%',
    height: 200,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  translationIntro: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  translationCard: {
    marginTop: Spacing.md,
    backgroundColor: 'transparent',
    width: '100%',
  },
  translationImageFrame: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  translationImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  translationCopy: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    gap: Spacing.xs,
  },
  translationSpeaker: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  translationEnglish: {
    color: Colors.text,
    fontSize: FontSize.md,
    lineHeight: 22,
  },

  // Vocab
  vocabSection: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  vocabHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  vocabWarning: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  vocabError: {
    fontSize: FontSize.xs,
    color: Colors.wrong,
    marginBottom: Spacing.sm,
  },
  audioGuideCard: {
    backgroundColor: '#f0f7f3',
    borderWidth: 1,
    borderColor: '#cfe7d8',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  audioGuideTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 2,
  },
  audioGuideText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  addRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  vocabInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: Colors.textLight },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  vocabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  vocabKashmiri: { fontSize: FontSize.md, fontWeight: '600', color: Colors.accent },
  vocabEnglish: { fontSize: FontSize.sm, color: Colors.textSecondary },
  vocabActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  syncBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.correct,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: Colors.wrong, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  vocabAudioBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  vocabAudioBtnActive: { backgroundColor: Colors.primary },
  vocabAudioIcon: { fontSize: 12, color: Colors.primary },
  vocabAudioIconActive: { color: '#fff' },
  vocabRecordBtn: {
    backgroundColor: '#fef2f2',
    minWidth: 76,
    paddingHorizontal: Spacing.md,
  },
  vocabRecordBtnActive: { backgroundColor: Colors.wrong },
  vocabRecordIcon: {
    color: Colors.wrong,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  vocabRecordIconActive: { color: '#fff' },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.wrong,
  },
  recordingText: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
    fontWeight: '600',
  },
  emptyVocab: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: FontSize.sm,
    marginTop: Spacing.lg,
  },
  errorText: {
    textAlign: 'center',
    color: Colors.wrong,
    fontSize: FontSize.lg,
    marginTop: Spacing.xxl,
  },
});
