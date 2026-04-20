import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
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
  findNodeHandle,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder,
  type AudioStatus,
} from 'expo-audio';
import { WebView } from 'react-native-webview';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { allCourses, type AudioClip } from '@/src/data/courses';
import { getSpokenKashmiriChapterContent } from '@/src/data/spokenKashmiriContent';
import { getLessonCourseContext } from '@/src/data/courseContext';
import { getKachruChapterVocabulary } from '@/src/data/kachruVocabulary';
import {
  KOUL_SECTION_LABELS,
  KOUL_SECTION_ORDER,
  type KoulSectionKey,
} from '@/src/data/koulContent';
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
import { markClipListened, getListenedClips } from '@/src/services/clipProgressService';

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
  const isKoul = course?.id === 'kashmiri-koul';
  const spokenContent =
    course?.id === 'spoken-kashmiri' && lesson
      ? getSpokenKashmiriChapterContent(lesson.number)
      : null;
  const kachruVocab =
    course?.id === 'spoken-kashmiri' && lesson
      ? getKachruChapterVocabulary(lesson.number)
      : null;
  const hasKachruVocab = !!(
    kachruVocab && kachruVocab.groups.some((g) => g.items.length > 0)
  );
  const lessonContext =
    course && lesson ? getLessonCourseContext(course.id, lesson.id) : null;
  const hasLessonContext = !!(
    lessonContext &&
    (
      lessonContext.note ||
      lessonContext.intro ||
      lessonContext.htmlContent ||
      lessonContext.highlights.length > 0 ||
      (lessonContext.sections && lessonContext.sections.length > 0)
    )
  );
  const lessonImageBaseUrl = lesson?.imageBaseUrl;

  useLayoutEffect(() => {
    if (!course || !lesson) return;

    navigation.setOptions({
      title: lesson.title,
      headerTitle: () => <Text style={styles.headerLinkText}>{lesson.title}</Text>,
      headerRight: () =>
        lesson.pageUrl ? (
          <ExternalLink href={lesson.pageUrl} style={styles.headerAction}>
            <Text style={styles.headerActionText}>koshur.org {'\u2197'}</Text>
          </ExternalLink>
        ) : null,
    });
  }, [course, lesson, navigation]);

  // Audio
  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackSessionRef = useRef(0);
  const currentClipIdxRef = useRef(0);
  const [currentClipIdx, setCurrentClipIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'vocab'>('content');
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const [learnHtmlHeight, setLearnHtmlHeight] = useState(900);
  const [koulSection, setKoulSection] = useState<KoulSectionKey>('lesson');
  const [koulPickerOpen, setKoulPickerOpen] = useState(false);
  const [kachruVocabPlaying, setKachruVocabPlaying] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const kashmiriInputRef = useRef<TextInput | null>(null);
  const englishInputRef = useRef<TextInput | null>(null);

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
  const vocabRecordingRef = useRef<AudioRecorder | null>(null);

  const [listenedClips, setListenedClips] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!courseId || !lessonId) return;
    getListenedClips(user?.id, courseId, lessonId).then(setListenedClips).catch(console.error);
  }, [courseId, lessonId, user?.id]);

  useEffect(() => {
    if (!user?.id || !lessonId) return;
    getLessonVocab(user.id, lessonId).then(setVocab).catch(console.error);
  }, [user?.id, lessonId]);

  useEffect(() => {
    currentClipIdxRef.current = currentClipIdx;
  }, [currentClipIdx]);

  const stopLessonAudio = useCallback(async (resetProgress = false, invalidateSession = true) => {
    if (invalidateSession) {
      playbackSessionRef.current += 1;
    }
    const currentSound = soundRef.current;
    soundRef.current = null;

    if (currentSound) {
      try {
        currentSound.pause();
      } catch {}
      try {
        currentSound.remove();
      } catch {}
    }

    setIsPlaying(false);
    setIsLoading(false);

    if (resetProgress) {
      setPosition(0);
      setDuration(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void stopLessonAudio(true);
        void stopAudio();
        setVocabPlayingId(null);
      };
    }, [stopLessonAudio])
  );

  useEffect(() => {
    return () => {
      void stopLessonAudio(true);
    };
  }, [stopLessonAudio]);


  useEffect(() => {
    return () => {
      void stopLessonAudio(true);
    };
  }, [stopLessonAudio]);

  useEffect(() => {
    if (!lessonImageBaseUrl && course?.id !== 'kashmiri-koul' && course?.id !== 'spoken-kashmiri') {
      return;
    }

    const pendingSpoken =
      spokenContent?.exchanges
        .filter((exchange) => imageAspectRatios[exchange.image] == null)
        .map((exchange) => ({
          filename: exchange.image,
          uri: (lessonImageBaseUrl ?? '') + exchange.image,
        })) ?? [];
    const pendingLessonImages =
      course?.id === 'learn-kashmiri' || course?.id === 'kashmiri-koul'
        ? (lesson?.images ?? [])
            .filter((img) => imageAspectRatios[img.filename] == null)
            .map((img) => ({
              filename: img.filename,
              uri: img.imageUrl ?? (lessonImageBaseUrl ?? '') + img.filename,
            }))
        : [];
    const pendingKachruVocab =
      kachruVocab && course?.id === 'spoken-kashmiri'
        ? kachruVocab.groups
            .flatMap((g) => g.items)
            .filter((it) => imageAspectRatios[it.image] == null)
            .map((it) => ({
              filename: it.image,
              uri: (lessonImageBaseUrl ?? '') + it.image,
            }))
        : [];
    const pending = [...pendingSpoken, ...pendingLessonImages, ...pendingKachruVocab];

    if (pending.length === 0) return;

    pending.forEach(({ filename, uri }) => {
      if (!uri) return;
      Image.getSize(
        uri,
        (width, height) => {
          if (!width || !height) return;
          setImageAspectRatios((current) => {
            if (current[filename] != null) return current;
            return { ...current, [filename]: width / height };
          });
        },
        () => {}
      );
    });
  }, [spokenContent, kachruVocab, lessonImageBaseUrl, imageAspectRatios, course?.id, lesson?.images]);

  if (!course || !lesson) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Lesson not found</Text>
      </SafeAreaView>
    );
  }

  const clips = isKoul
    ? lesson.audioClips.filter((c) => c.section === koulSection)
    : lesson.audioClips;
  const displayImages = isKoul
    ? (lesson.images ?? []).filter((img) => img.section === koulSection)
    : lesson.images ?? [];
  // Guard against stale currentClipIdx during Koul section transitions.
  const safeCurrentClipIdx = Math.min(
    currentClipIdx,
    Math.max(clips.length - 1, 0)
  );
  const currentClip = clips[safeCurrentClipIdx];

  const availableKoulSections = isKoul
    ? KOUL_SECTION_ORDER.filter((key) =>
        lesson.audioClips.some((c) => c.section === key)
      )
    : [];


  const onPlaybackStatusUpdate = useCallback((status: AudioStatus, clipIdx: number, sound: AudioPlayer) => {
    if (!status.isLoaded) return;
    setPosition((status.currentTime || 0) * 1000);
    setDuration((status.duration || 0) * 1000);
    setIsPlaying(status.playing);

    if (status.didJustFinish) {
      try {
        sound.remove();
      } catch {}
      if (soundRef.current === sound) {
        soundRef.current = null;
      }
      setIsPlaying(false);

      if (courseId && lessonId && clips[clipIdx]) {
        const finishedFilename = clips[clipIdx].filename;
        setListenedClips((prev) => new Set([...prev, finishedFilename]));
        markClipListened(user?.id, courseId, lessonId, finishedFilename).catch(console.error);
      }


      if (clipIdx < clips.length - 1) {
        void playClip(clipIdx + 1);
      }
    }
  }, [clips, courseId, lessonId, user?.id]);

  const playClip = useCallback(async (idx: number) => {
    setError('');
    let sessionId = 0;

    try {
      await stopAudio();
      setVocabPlayingId(null);
      await stopLessonAudio(false, false);

      playbackSessionRef.current += 1;
      sessionId = playbackSessionRef.current;

      setCurrentClipIdx(idx);
      currentClipIdxRef.current = idx;
      setIsLoading(true);
      setPosition(0);
      setDuration(0);

      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });

      if (playbackSessionRef.current !== sessionId) {
        return;
      }

      const uri = clips[idx].audioUrl ?? lesson.audioBaseUrl + clips[idx].filename;
      const sound = createAudioPlayer({ uri }, { updateInterval: 250 });
      soundRef.current = sound;
      sound.addListener('playbackStatusUpdate', (status) => {
        if (playbackSessionRef.current !== sessionId || soundRef.current !== sound) {
          return;
        }
        onPlaybackStatusUpdate(status, idx, sound);
      });
      sound.play();
    } catch (e: any) {
      if (playbackSessionRef.current === sessionId) {
        setError('Failed to load audio');
      }
      console.error('Audio error:', e);
    } finally {
      if (playbackSessionRef.current === sessionId) {
        setIsLoading(false);
      }
    }
  }, [clips, lesson.audioBaseUrl, onPlaybackStatusUpdate, stopLessonAudio]);

  const scrollVocabInputsIntoView = (input: TextInput | null) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const inputHandle = input ? findNodeHandle(input) : null;
        if (!inputHandle) return;
        scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
          inputHandle,
          24,
          true
        );
      }, 150);
    });
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) {
      await playClip(currentClipIdxRef.current);
      return;
    }
    if (!soundRef.current.isLoaded) {
      await playClip(currentClipIdxRef.current);
      return;
    }
    if (soundRef.current.playing) {
      soundRef.current.pause();
      setIsPlaying(false);
    } else {
      soundRef.current.play();
      setIsPlaying(true);
    }
  };

  const seekBy = async (ms: number) => {
    if (!soundRef.current) return;
    if (!soundRef.current.isLoaded) return;
    const newPos = Math.max(
      0,
      Math.min(position + ms, duration || 0)
    );
    await soundRef.current.seekTo(newPos / 1000);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const renderPlayPauseIcon = () => {
    if (isLoading) {
      return <ActivityIndicator color="#fff" size="small" />;
    }

    if (isPlaying) {
      return (
        <View style={styles.pauseIcon} pointerEvents="none">
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </View>
      );
    }

    return <Text style={styles.playIcon}>{'\u25B6'}</Text>;
  };

  const handleKachruVocabPlay = async (audioFilename: string) => {
    if (!lesson.audioBaseUrl) return;
    if (kachruVocabPlaying === audioFilename) {
      await stopAudio();
      setKachruVocabPlaying(null);
      return;
    }
    try {
      await stopLessonAudio();
      setVocabPlayingId(null);
      setKachruVocabPlaying(audioFilename);
      await playAudio(lesson.audioBaseUrl + audioFilename, {
        onFinish: () => setKachruVocabPlaying(null),
      });
    } catch (e) {
      console.error('Kachru vocab playback error:', e);
      setKachruVocabPlaying(null);
    }
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
      await stopLessonAudio();
      await playAudio(entry.audio_url, {
        onFinish: () => setVocabPlayingId(null),
      });
    } catch (e) {
      console.error('Vocab playback error:', e);
      setVocabPlayingId(null);
    }
  };

  const handleVocabRecord = async (entry: LessonVocabEntry) => {
    if (!user?.id || !entry.word_id) return;

    // If already recording this entry, stop and save
    if (vocabRecordingId === entry.id && vocabRecordingRef.current) {
      setVocabSavingId(entry.id);
      try {
        const url = await stopAndUploadRecording(vocabRecordingRef.current, user.id, entry.word_id);
        // Update local vocab state with new audio URL
        setVocab((prev) =>
          prev.map((v) => (v.id === entry.id ? { ...v, audio_url: url } : v))
        );
        try {
          await linkAudioToWord(entry.word_id, url);
          invalidateWordCache();
        } catch (linkError) {
          console.error('Vocab recording link error:', linkError);
        }
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
      await stopLessonAudio();
      await stopAudio();
      setVocabPlayingId(null);
      if (vocabRecordingRef.current) {
        await vocabRecordingRef.current.stop();
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
  const hasImages = displayImages.length > 0;
  const shouldRenderLearnHtml = !!(
    course?.id === 'learn-kashmiri' &&
    lessonContext?.htmlContent
  );
  const learnHtmlDocument = shouldRenderLearnHtml
    ? `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 0 0 24px;
        background: #ffffff;
        color: #2f2a25;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }
      p {
        margin: 0 0 14px;
        font-size: 16px;
      }
      div {
        margin: 0 0 18px;
      }
      img {
        display: block;
        width: 100%;
        height: auto;
        background: #f6f1e7;
        border-radius: 12px;
        margin: 0 0 10px;
      }
      a {
        color: #2f6f53;
      }
    </style>
  </head>
  <body>
    ${lessonContext!.htmlContent!}
    <script>
      (function() {
        function sendHeight() {
          var height = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
          );
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(String(height));
          }
        }
        window.addEventListener('load', function() {
          setTimeout(sendHeight, 80);
          setTimeout(sendHeight, 300);
          setTimeout(sendHeight, 700);
        });
      })();
    </script>
  </body>
</html>`
    : '';
  const shouldRenderLearnImageCaptions = !!(
    course?.id === 'learn-kashmiri' &&
    lessonContext &&
    hasImages &&
    !lessonContext.htmlContent &&
    lessonContext.sections?.some((section) => section.items.length > 0)
  );
  const hasContentTab = !!(
    (spokenContent && (spokenIntro || spokenContent.exchanges.length > 0)) ||
    hasLessonContext ||
    (hasImages && !spokenContent) ||
    hasKachruVocab ||
    (isKoul && availableKoulSections.length > 0)
  );

  useEffect(() => {
    if (!hasContentTab && activeTab !== 'vocab') {
      setActiveTab('vocab');
    }
  }, [activeTab, hasContentTab]);

  useEffect(() => {
    if (!isKoul) return;
    setCurrentClipIdx(0);
    currentClipIdxRef.current = 0;
    void stopLessonAudio(true);
  }, [isKoul, koulSection, stopLessonAudio]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Pinned Audio Player */}
        <View style={styles.playerCard}>
          {/* Koul section picker */}
          {isKoul && availableKoulSections.length > 1 && (
            <View style={styles.koulPickerWrap}>
              <Pressable
                style={[
                  styles.koulPickerBtn,
                  koulPickerOpen && styles.koulPickerBtnOpen,
                ]}
                onPress={() => setKoulPickerOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={`Section: ${KOUL_SECTION_LABELS[koulSection]}. Tap to change.`}
                accessibilityState={{ expanded: koulPickerOpen }}
              >
                <View style={styles.koulPickerTextBlock}>
                  <Text style={styles.koulPickerPrefix}>SECTION</Text>
                  <Text style={styles.koulPickerLabel} numberOfLines={1}>
                    {KOUL_SECTION_LABELS[koulSection]}
                  </Text>
                </View>
                <Text style={styles.koulPickerCount}>
                  {clips.length} clip{clips.length === 1 ? '' : 's'}
                </Text>
                <View
                  style={[
                    styles.koulPickerChevronBadge,
                    koulPickerOpen && styles.koulPickerChevronBadgeOpen,
                  ]}
                >
                  <Text
                    style={[
                      styles.koulPickerChevron,
                      koulPickerOpen && styles.koulPickerChevronOpen,
                    ]}
                  >
                    {koulPickerOpen ? '\u2303' : '\u2304'}
                  </Text>
                </View>
              </Pressable>
              {koulPickerOpen && (
                <View style={styles.koulPickerMenu}>
                  {availableKoulSections.map((key) => {
                    const count = lesson.audioClips.filter(
                      (c) => c.section === key
                    ).length;
                    const active = key === koulSection;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          setKoulSection(key);
                          setKoulPickerOpen(false);
                        }}
                        style={[
                          styles.koulPickerItem,
                          active && styles.koulPickerItemActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.koulPickerItemCheck,
                            active && styles.koulPickerItemCheckActive,
                          ]}
                        >
                          {active ? '\u2713' : ''}
                        </Text>
                        <Text
                          style={[
                            styles.koulPickerItemText,
                            active && styles.koulPickerItemTextActive,
                          ]}
                        >
                          {KOUL_SECTION_LABELS[key]}
                        </Text>
                        <Text
                          style={[
                            styles.koulPickerItemCount,
                            active && styles.koulPickerItemCountActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Clip selector for multi-clip lessons */}
          {clips.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.clipScroll}
              contentContainerStyle={styles.clipRow}
            >
              {clips.map((clip, idx) => {
                const isListened = listenedClips.has(clip.filename);
                const isActive = idx === safeCurrentClipIdx;
                return (
                  <Pressable
                    key={`${clip.section ?? 'section'}-${clip.filename}-${idx}`}
                    style={[
                      styles.clipChip,
                      isActive && styles.clipChipActive,
                      isListened && !isActive && styles.clipChipListened,
                    ]}
                    onPress={() => playClip(idx)}
                  >
                    <Text
                      style={[
                        styles.clipChipText,
                        isActive && styles.clipChipTextActive,
                        isListened && !isActive && styles.clipChipTextListened,
                      ]}
                      numberOfLines={1}
                    >
                      {isListened ? '\u2713 ' : ''}{clip.label || clip.filename.replace('.mp3', '')}
                    </Text>
                  </Pressable>
                );
              })}
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
                ? `Clip ${safeCurrentClipIdx + 1}/${clips.length}`
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
                  onPress={() => { if (safeCurrentClipIdx > 0) playClip(safeCurrentClipIdx - 1); }}
                  style={styles.seekBtn}
                  disabled={safeCurrentClipIdx === 0}
                >
                  <Text style={[styles.seekText, safeCurrentClipIdx === 0 && { color: Colors.border }]}>{'\u23EE'}</Text>
                </Pressable>
                <Pressable onPress={togglePlayPause} style={[styles.playBtn, isLoading && styles.playBtnLoading]} disabled={isLoading}>
                  {renderPlayPauseIcon()}
                </Pressable>
                <Pressable
                  onPress={() => { if (safeCurrentClipIdx < clips.length - 1) playClip(safeCurrentClipIdx + 1); }}
                  style={styles.seekBtn}
                  disabled={safeCurrentClipIdx === clips.length - 1}
                >
                  <Text style={[styles.seekText, safeCurrentClipIdx === clips.length - 1 && { color: Colors.border }]}>{'\u23ED'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => seekBy(-15000)} style={styles.seekBtn}>
                  <Text style={styles.seekText}>-15s</Text>
                </Pressable>
                <Pressable onPress={togglePlayPause} style={[styles.playBtn, isLoading && styles.playBtnLoading]} disabled={isLoading}>
                  {renderPlayPauseIcon()}
                </Pressable>
                <Pressable onPress={() => seekBy(15000)} style={styles.seekBtn}>
                  <Text style={styles.seekText}>+15s</Text>
                </Pressable>
              </>
            )}
          </View>
          {error ? <Text style={styles.audioError}>{error}</Text> : null}
        </View>

        {/* Pinned tab bar */}
        {hasContentTab ? (
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
        ) : null}

        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            activeTab === 'vocab' && styles.vocabScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {hasContentTab && activeTab === 'content' ? (
            <>
              {/* Kachru vocabulary — rendered at the top of each lesson tab */}
              {hasKachruVocab && kachruVocab && (
                <View style={styles.imagesSection}>
                  <Text style={styles.sectionTitle}>Vocabulary</Text>
                  {kachruVocab.groups.map((group) => (
                    <View key={group.title} style={styles.kachruVocabGroup}>
                      <Text style={styles.contextSectionTitle}>{group.title}</Text>
                      {group.items.map((item) => {
                        const imageUri = lesson.imageBaseUrl
                          ? lesson.imageBaseUrl + item.image
                          : undefined;
                        const aspect = imageAspectRatios[item.image];
                        const isPlaying = kachruVocabPlaying === item.audio;
                        return (
                          <Pressable
                            key={`${group.title}-${item.audio}`}
                            onPress={() => handleKachruVocabPlay(item.audio)}
                            style={styles.kachruVocabCard}
                          >
                            {imageUri ? (
                              <View
                                style={[
                                  styles.translationImageFrame,
                                  aspect
                                    ? { aspectRatio: aspect, height: undefined }
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
                            <View style={styles.kachruVocabPlayRow}>
                              <View
                                style={[
                                  styles.kachruVocabPlayBtn,
                                  isPlaying && styles.kachruVocabPlayBtnActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.kachruVocabPlayIcon,
                                    isPlaying &&
                                      styles.kachruVocabPlayIconActive,
                                  ]}
                                >
                                  {isPlaying ? '\u23F9' : '\u25B6'}
                                </Text>
                              </View>
                              <Text style={styles.kachruVocabPlayLabel}>
                                {isPlaying ? 'Stop' : 'Play'}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}

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
                        {imageUri && imageAspectRatio ? (
                          <View
                            style={[
                              styles.translationImageFrame,
                              { aspectRatio: imageAspectRatio, height: undefined },
                            ]}
                          >
                            <Image
                              source={{ uri: imageUri }}
                              style={styles.translationImage}
                              resizeMode="contain"
                            />
                          </View>
                        ) : imageUri ? (
                          <View style={styles.translationImagePlaceholder}>
                            <ActivityIndicator size="small" color={Colors.primary} />
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
              {hasLessonContext && lessonContext && (
                <View style={styles.contextSection}>
                  <Text style={styles.sectionTitle}>Lesson Content</Text>
                  {!shouldRenderLearnHtml && lessonContext.note ? (
                    <Text style={styles.contextNote}>{lessonContext.note}</Text>
                  ) : null}
                  {!shouldRenderLearnHtml && lessonContext.intro ? (
                    <Text style={styles.contextIntro}>{lessonContext.intro}</Text>
                  ) : null}
                  {shouldRenderLearnHtml ? (
                    <>
                      {Platform.OS === 'web' ? (
                        <Text style={styles.contextIntro}>
                          Learn Kashmiri HTML rendering is available in the native app view.
                        </Text>
                      ) : (
                        <View style={styles.learnWebViewFrame}>
                          <WebView
                            originWhitelist={['*']}
                            source={{
                              html: learnHtmlDocument,
                              baseUrl: lessonContext.pageUrl,
                            }}
                            style={[styles.learnWebView, { height: learnHtmlHeight }]}
                            scrollEnabled={false}
                            nestedScrollEnabled={false}
                            onMessage={(event) => {
                              const nextHeight = Number(event.nativeEvent.data);
                              if (Number.isFinite(nextHeight) && nextHeight > 0) {
                                setLearnHtmlHeight(nextHeight);
                              }
                            }}
                            onShouldStartLoadWithRequest={(request) => {
                              if (
                                request.url &&
                                request.url !== 'about:blank' &&
                                request.url !== lessonContext.pageUrl
                              ) {
                                Linking.openURL(request.url);
                                return false;
                              }
                              return true;
                            }}
                          />
                        </View>
                      )}
                    </>
                  ) : shouldRenderLearnImageCaptions ? (() => {
                    const sectionBlocks = lessonContext.sections?.map((section) => {
                      if (section.items.length === 0) return null;

                      return (
                        <View key={section.title} style={styles.contextSectionBlock}>
                          <Text style={styles.contextSectionTitle}>{section.title}</Text>
                          {section.items.map((item, idx) => {
                            const mappedFilename = section.images?.[idx];
                            const image = mappedFilename
                              ? lesson.images?.find((entry) => entry.filename === mappedFilename)
                              : lesson.images?.[idx];
                            const imageUri = image && lesson.imageBaseUrl
                              ? lesson.imageBaseUrl + image.filename
                              : undefined;
                            const imageAspectRatio = image
                              ? imageAspectRatios[image.filename]
                              : undefined;

                            return (
                              <View key={`${section.title}-${idx}`} style={styles.translationCard}>
                                {imageUri && imageAspectRatio ? (
                                  <View
                                    style={[
                                      styles.translationImageFrame,
                                      { aspectRatio: imageAspectRatio, height: undefined },
                                    ]}
                                  >
                                    <Image
                                      source={{ uri: imageUri }}
                                      style={styles.translationImage}
                                      resizeMode="contain"
                                    />
                                  </View>
                                ) : imageUri ? (
                                  <View style={styles.translationImagePlaceholder}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                  </View>
                                ) : null}
                                <View style={styles.translationCopy}>
                                  <Text style={styles.translationEnglish}>{item}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    }) ?? [];

                    const usedFilenames = new Set(
                      lessonContext.sections?.flatMap((section) => section.images ?? []) ?? []
                    );
                    const remainingImages = (lesson.images ?? []).filter(
                      (img) => !usedFilenames.has(img.filename)
                    );

                    return (
                      <>
                        {sectionBlocks}
                        {remainingImages.length > 0 ? (
                          <View style={styles.contextSectionBlock}>
                            <Text style={styles.contextSectionTitle}>More Examples</Text>
                            {remainingImages.map((img) => {
                              const imageUri = lesson.imageBaseUrl
                                ? lesson.imageBaseUrl + img.filename
                                : undefined;
                              const imageAspectRatio = imageAspectRatios[img.filename];

                              return (
                                <View key={img.filename} style={styles.translationCard}>
                                  {imageUri && imageAspectRatio ? (
                                    <View
                                      style={[
                                        styles.translationImageFrame,
                                        { aspectRatio: imageAspectRatio, height: undefined },
                                      ]}
                                    >
                                      <Image
                                        source={{ uri: imageUri }}
                                        style={styles.translationImage}
                                        resizeMode="contain"
                                      />
                                    </View>
                                  ) : imageUri ? (
                                    <View style={styles.translationImagePlaceholder}>
                                      <ActivityIndicator size="small" color={Colors.primary} />
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        ) : null}
                      </>
                    );
                  })() : lessonContext.sections?.map((section) => {
                    // Detect section type from content patterns
                    const isTable = section.items.length > 0 && section.items.every((item) => item.includes(' - '));
                    const isDialogue = /dialogue|conversation/i.test(section.title);
                    const isNumbered = /practice|listen|repeat|drill/i.test(section.title);

                    return (
                      <View key={section.title} style={styles.contextSectionBlock}>
                        <Text style={styles.contextSectionTitle}>{section.title}</Text>

                        {isTable ? (
                          // Render as a 2-column table (vocabulary, numerals, etc.)
                          <View style={styles.contextTable}>
                            {section.items.map((item) => {
                              const parts = item.split(' - ');
                              const left = parts[0]?.trim() ?? '';
                              const right = parts.slice(1).join(' - ').trim();
                              return (
                                <View key={item} style={styles.contextTableRow}>
                                  <Text style={styles.contextTableKashmiri}>{left}</Text>
                                  <Text style={styles.contextTableEnglish}>{right}</Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : isDialogue ? (
                          section.items.map((item, idx) => (
                            <View key={`${section.title}-${idx}`} style={styles.contextDialogueLine}>
                              <Text style={styles.contextDialogueText}>{item}</Text>
                            </View>
                          ))
                        ) : isNumbered ? (
                          // Render as numbered list
                          section.items.map((item, idx) => (
                            <View key={`${section.title}-${idx}`} style={styles.contextNumberedRow}>
                              <Text style={styles.contextNumber}>{idx + 1}.</Text>
                              <Text style={styles.contextNumberedText}>{item}</Text>
                            </View>
                          ))
                        ) : (
                          // Default: bullet list
                          section.items.map((item, idx) => (
                            <View key={`${section.title}-${idx}`} style={styles.contextBulletRow}>
                              <Text style={styles.contextBullet}>{'\u2022'}</Text>
                              <Text style={styles.contextBulletText}>{item}</Text>
                            </View>
                          ))
                        )}
                      </View>
                    );
                  })}
                  {!shouldRenderLearnImageCaptions && lessonContext.highlights.map((highlight, idx) => (
                    <View key={`hl-${idx}`} style={styles.contextBulletRow}>
                      <Text style={styles.contextBullet}>{'\u2022'}</Text>
                      <Text style={styles.contextBulletText}>{highlight}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Image-only course content */}
              {hasImages && !spokenContent && !hasLessonContext && (
                <View style={styles.imagesSection}>
                  <Text style={styles.sectionTitle}>
                    {isKoul
                      ? KOUL_SECTION_LABELS[koulSection]
                      : 'Lesson Content'}
                  </Text>
                  {displayImages.map((img, idx) => {
                    const uri = img.imageUrl ?? lesson.imageBaseUrl + img.filename;
                    const aspect = imageAspectRatios[img.filename];
                    return (
                      <View
                        key={`${img.filename}-${idx}`}
                        style={[
                          styles.koulImageFrame,
                          aspect ? { aspectRatio: aspect, height: undefined } : null,
                        ]}
                      >
                        <Image
                          source={{ uri }}
                          style={styles.koulImage}
                          resizeMode="contain"
                        />
                      </View>
                    );
                  })}
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
                  ref={kashmiriInputRef}
                  style={[styles.vocabInput, { flex: 1.2 }]}
                  placeholder="Kashmiri"
                  placeholderTextColor={Colors.textLight}
                  value={newKashmiri}
                  onChangeText={setNewKashmiri}
                  onFocus={() => scrollVocabInputsIntoView(kashmiriInputRef.current)}
                />
                <TextInput
                  ref={englishInputRef}
                  style={[styles.vocabInput, { flex: 1 }]}
                  placeholder="English"
                  placeholderTextColor={Colors.textLight}
                  value={newEnglish}
                  onChangeText={setNewEnglish}
                  onFocus={() => scrollVocabInputsIntoView(englishInputRef.current)}
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
  headerLinkText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
  },
  headerAction: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  headerActionText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
    letterSpacing: 0.2,
  },
  scrollContent: { paddingBottom: Spacing.xxl },
  vocabScrollContent: { paddingBottom: Spacing.xxl * 3 },

  // Player
  playerCard: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 1,
  },
  clipScroll: { marginBottom: Spacing.sm },
  clipRow: { gap: Spacing.xs },
  clipChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
    maxWidth: 100,
  },
  clipChipActive: { backgroundColor: Colors.primary },
  clipChipListened: { backgroundColor: '#eef7f1' },
  clipChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  clipChipTextActive: { color: '#fff', fontFamily: FontFamily.bodyBold },
  clipChipTextListened: { color: Colors.correct, fontFamily: FontFamily.bodyBold },
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
    marginTop: 4,
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
    marginTop: Spacing.sm,
  },
  seekBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  seekText: { fontSize: FontSize.md, color: Colors.textSecondary, fontFamily: FontFamily.bodySemi },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnLoading: { backgroundColor: Colors.textLight },
  playIcon: { fontSize: 18, color: '#fff' },
  pauseIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  audioError: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xs,
    color: Colors.wrong,
    textAlign: 'center',
  },
  contextSection: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  contextNote: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    fontFamily: FontFamily.bodySemi,
    lineHeight: 20,
  },
  contextIntro: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  learnWebViewFrame: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  learnWebView: {
    width: '100%',
    backgroundColor: Colors.surface,
  },
  contextSectionBlock: {
    gap: Spacing.xs,
  },
  contextSectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.xs,
  },
  contextBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  contextBullet: {
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 22,
  },
  contextBulletText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  // Table rendering (vocabulary, numerals)
  contextTable: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  contextTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contextTableKashmiri: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemi,
    color: Colors.accent,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceLight,
  },
  contextTableEnglish: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  // Dialogue rendering
  contextDialogueLine: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primaryLight,
    marginVertical: 2,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
  },
  contextDialogueText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  // Numbered list
  contextNumberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  contextNumber: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
    width: 24,
    textAlign: 'right',
  },
  contextNumberedText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 21,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: '#dfe9e3',
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#c6d7cd',
    marginTop: 6,
    marginBottom: 2,
  },
  tabButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
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
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tabButtonTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyBold,
  },

  // Images
  imagesSection: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontFamily: FontFamily.heading, color: Colors.text },
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
  translationImagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
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
    fontFamily: FontFamily.bodyBold,
  },
  translationEnglish: {
    color: Colors.text,
    fontSize: FontSize.md,
    lineHeight: 22,
  },

  // Vocab
  vocabSection: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg },
  vocabHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  vocabWarning: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontFamily: FontFamily.bodySemi,
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
    fontFamily: FontFamily.bodyBold,
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
  addBtnText: { color: '#fff', fontSize: 22, fontFamily: FontFamily.bodyBold, lineHeight: 24 },
  vocabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  vocabKashmiri: { fontSize: FontSize.md, fontFamily: FontFamily.heading, color: Colors.accent },
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
  syncBadgeText: { color: '#fff', fontSize: 12, fontFamily: FontFamily.bodyBold },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: Colors.wrong, fontSize: 18, fontFamily: FontFamily.bodyBold, lineHeight: 20 },
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
    fontFamily: FontFamily.bodyBold,
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
    fontFamily: FontFamily.bodySemi,
  },
  emptyVocab: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: FontSize.sm,
    marginTop: Spacing.lg,
  },

  // Koul section picker
  koulPickerWrap: {
    marginBottom: Spacing.sm,
    position: 'relative',
    zIndex: 2,
  },
  koulPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  koulPickerBtnOpen: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.surfaceLight,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  koulPickerTextBlock: {
    flex: 1,
  },
  koulPickerPrefix: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 1,
  },
  koulPickerLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  koulPickerCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontVariant: ['tabular-nums'],
  },
  koulPickerChevronBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  koulPickerChevronBadgeOpen: {
    backgroundColor: Colors.primaryDark,
  },
  koulPickerChevron: {
    fontSize: 18,
    lineHeight: 20,
    color: '#fff',
    fontWeight: '700',
  },
  koulPickerChevronOpen: {
    color: '#fff',
  },
  koulPickerMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: Colors.primaryDark,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  koulPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  koulPickerItemActive: {
    backgroundColor: Colors.surfaceLight,
  },
  koulPickerItemCheck: {
    width: 16,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  koulPickerItemCheckActive: {
    color: Colors.primary,
  },
  koulPickerItemText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  koulPickerItemTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  koulPickerItemCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontVariant: ['tabular-nums'],
  },
  koulPickerItemCountActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Koul image rendering
  koulImageFrame: {
    width: '100%',
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
  },
  koulImage: {
    width: '100%',
    height: '100%',
  },

  // Kachru vocabulary block
  kachruVocabGroup: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  kachruVocabCard: {
    marginTop: Spacing.sm,
    width: '100%',
  },
  kachruVocabPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  kachruVocabPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kachruVocabPlayBtnActive: {
    backgroundColor: Colors.primary,
  },
  kachruVocabPlayIcon: {
    fontSize: 12,
    color: Colors.primary,
  },
  kachruVocabPlayIconActive: {
    color: '#fff',
  },
  kachruVocabPlayLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    textAlign: 'center',
    color: Colors.wrong,
    fontSize: FontSize.lg,
    marginTop: Spacing.xxl,
  },
});
