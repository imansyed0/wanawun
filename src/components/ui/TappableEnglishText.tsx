import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { BorderRadius, Colors, FontFamily, FontSize, LineHeight, Spacing } from '@/src/constants/theme';
import type { TextToken } from '@/src/lib/dictionary';
import {
  dictionaryAudioUrls,
  normalizeEnglish,
  tokenizeEnglish,
  type EnglishMatch,
  type KashmiriTranslation,
} from '@/src/lib/englishDictionary';
import { WordSheet } from '@/src/components/ui/WordSheet';
import { pauseAllAudio } from '@/src/services/audioService';
import { useQuickAddStore } from '@/src/stores/quickAddStore';
import { useTutorialStore } from '@/src/stores/tutorialStore';
import { knownWordStyle } from '@/src/components/ui/TappableKashmiriText';

export interface TappableEnglishTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * English lesson translation. Words and phrases found in the English → Kashmiri
 * dictionary get a dotted underline and open a sheet with the Kashmiri
 * translation and pronunciation. Every other word can be tapped too: it opens
 * the add-to-glossary sheet with that English word filled in.
 */
export function TappableEnglishText({ text, style, numberOfLines }: TappableEnglishTextProps) {
  const tokens = useMemo(() => tokenizeEnglish(text), [text]);
  const firstWordIdx = useMemo(() => tokens.findIndex((t) => t.isWord), [tokens]);
  const [selected, setSelected] = useState<TextToken<EnglishMatch> | null>(null);

  return (
    <>
      <Text style={style} numberOfLines={numberOfLines}>
        {tokens.map((token, idx) => {
          if (!token.isWord) return token.text;
          const english = glossaryEnglish(token.text, idx === firstWordIdx);
          return token.entry ? (
            <Text
              key={`${idx}-${token.text}`}
              onPress={(e) => {
                // Don't also trigger a pressable card this text sits in.
                e?.stopPropagation?.();
                void pauseAllAudio();
                setSelected(token);
              }}
              suppressHighlighting={false}
              // "link", not "button": these words can sit inside pressable
              // lesson cards, and a button can't contain another button.
              accessibilityRole="link"
              accessibilityHint="Shows the Kashmiri translation"
              style={knownWordStyle}
            >
              {token.text}
            </Text>
          ) : (
            <Text
              key={`${idx}-${token.text}`}
              onPress={(e) => {
                e?.stopPropagation?.();
                openAddWord(english);
              }}
              suppressHighlighting={false}
              accessibilityHint={`Adds "${english}" to your glossary`}
            >
              {token.text}
            </Text>
          );
        })}
      </Text>
      {selected ? (
        <EnglishWordSheet
          token={selected}
          onClose={() => setSelected(null)}
          onAddToGlossary={() => {
            const english = glossaryEnglish(selected.text, tokens.indexOf(selected) === firstWordIdx);
            // Carry the translation that was on screen, so the word arrives
            // filled in and keeps the dictionary's pronunciation.
            const translations = selected.entry?.translations ?? [];
            const translation = translations.find((t) => t.audioId) ?? translations[0];
            setSelected(null);
            // Let the translation sheet finish closing first; iOS won't present
            // a second modal while the first is still being dismissed.
            setTimeout(() => openAddWord(english, translation), 350);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * The English to put in the glossary for a tapped word: trimmed of edge
 * punctuation, and lowercased when it's only capitalised for starting the line.
 */
function glossaryEnglish(raw: string, isFirstWord: boolean): string {
  const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const onlyInitialCap = /^\p{Lu}[^\p{Lu}]*$/u.test(word);
  return isFirstWord && onlyInitialCap && word !== 'I'
    ? word.charAt(0).toLowerCase() + word.slice(1)
    : word;
}

function openAddWord(english: string, translation?: KashmiriTranslation) {
  useQuickAddStore.getState().open({
    english,
    kashmiri: translation?.kashmiri ?? '',
    audioId: translation?.audioId,
  });
  useTutorialStore.getState().notify('addModalOpened');
}

type AudioState = 'idle' | 'loading' | 'playing' | 'done' | 'error';

// A clip that hasn't loaded by then is treated as unavailable and the next
// candidate URL (e.g. DSAL after the bucket) is tried.
const LOAD_TIMEOUT_MS = 6000;

/** One short pronunciation at a time; everything is released on unmount. */
function useSheetAudio() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [state, setState] = useState<AudioState>('idle');

  const release = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      try {
        player.pause();
      } catch {}
      try {
        player.remove();
      } catch {}
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    release();
  }, [release]);

  useEffect(() => stop, [stop]);

  const play = useCallback(
    async (audioId: string) => {
      stop();
      const session = sessionRef.current;
      setActiveId(audioId);
      setState('loading');
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      } catch {}

      const urls = dictionaryAudioUrls(audioId);
      const tryUrl = (i: number) => {
        if (session !== sessionRef.current) return;
        release();
        if (i >= urls.length) {
          setState('error');
          return;
        }
        let player: AudioPlayer;
        try {
          player = createAudioPlayer({ uri: urls[i] }, { updateInterval: 250 });
        } catch {
          tryUrl(i + 1);
          return;
        }
        playerRef.current = player;
        let loaded = false;
        timerRef.current = setTimeout(() => {
          if (!loaded && session === sessionRef.current) tryUrl(i + 1);
        }, LOAD_TIMEOUT_MS);
        player.addListener('playbackStatusUpdate', (status) => {
          if (session !== sessionRef.current || playerRef.current !== player) return;
          if (status.isLoaded && !loaded) {
            loaded = true;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (status.didJustFinish) setState('done');
          else if (status.playing) setState('playing');
        });
        try {
          player.play();
        } catch {
          tryUrl(i + 1);
        }
      };
      tryUrl(0);
    },
    [release, stop]
  );

  return { play, stop, activeId, state };
}

interface EnglishWordSheetProps {
  token: TextToken<EnglishMatch>;
  onClose: () => void;
  /** Shows an "Add to glossary" button that hands the word to the add sheet. */
  onAddToGlossary?: () => void;
}

export function EnglishWordSheet({ token, onClose, onAddToGlossary }: EnglishWordSheetProps) {
  const audio = useSheetAudio();
  const match = token.entry;

  const close = () => {
    audio.stop();
    onClose();
  };

  if (!match) return null;
  const showKey = normalizeEnglish(token.text) !== match.key;

  return (
    <WordSheet visible onClose={close} closeLabel="Close translation">
      <Text style={styles.english}>{token.text}</Text>
      {showKey ? <Text style={styles.meta}>Dictionary form: {match.key}</Text> : null}

      {match.translations.map((t, idx) => (
        <TranslationRow
          key={`${t.kashmiri}-${idx}`}
          translation={t}
          audioState={t.audioId && audio.activeId === t.audioId ? audio.state : 'idle'}
          onPlay={t.audioId ? () => void audio.play(t.audioId!) : undefined}
        />
      ))}

      {onAddToGlossary ? (
        <Pressable
          onPress={() => {
            audio.stop();
            onAddToGlossary();
          }}
          style={styles.addBtn}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>+ Add to glossary</Text>
        </Pressable>
      ) : null}

      <Text style={styles.attribution}>
        From the Kaeshir Database (Izan Majeed) and S. Hassan, Kashmiri-English Dictionary (DSAL, University of Chicago)
      </Text>
    </WordSheet>
  );
}

function TranslationRow({
  translation,
  audioState,
  onPlay,
}: {
  translation: KashmiriTranslation;
  audioState: AudioState;
  onPlay?: () => void;
}) {
  const label =
    audioState === 'loading'
      ? 'Loading'
      : audioState === 'playing'
        ? 'Playing'
        : audioState === 'done'
          ? 'Replay'
          : audioState === 'error'
            ? 'Retry'
            : 'Play';

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kashmiriRoman}>{translation.kashmiri}</Text>
        {translation.partOfSpeech ? <Text style={styles.meta}>{translation.partOfSpeech}</Text> : null}
        {onPlay && audioState === 'error' ? (
          <Text style={styles.audioError}>Audio couldn't be loaded.</Text>
        ) : null}
      </View>
      {onPlay ? (
        <Pressable
          onPress={onPlay}
          style={[styles.playBtn, audioState === 'playing' && styles.playBtnActive]}
          accessibilityRole="button"
          accessibilityLabel={`${label} pronunciation of ${translation.kashmiri}`}
        >
          {audioState === 'loading' ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[styles.playIcon, audioState === 'playing' && styles.playIconActive]}>
              {audioState === 'done' || audioState === 'error' ? '↻' : '▶'}
            </Text>
          )}
          <Text style={[styles.playLabel, audioState === 'playing' && styles.playIconActive]}>
            {label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  english: {
    fontSize: FontSize.xl,
    lineHeight: LineHeight.body(FontSize.xl),
    fontFamily: FontFamily.bodyBold,
    color: Colors.text,
  },
  meta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  kashmiriRoman: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.body(FontSize.lg),
    fontFamily: FontFamily.bodySemi,
    color: Colors.primaryDark,
  },
  audioError: {
    fontSize: FontSize.xs,
    color: Colors.wrong,
    marginTop: 2,
  },
  playBtn: {
    minWidth: 72,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
  },
  playBtnActive: { backgroundColor: Colors.primary },
  playIcon: { fontSize: FontSize.md, color: Colors.primary },
  playIconActive: { color: '#fff' },
  playLabel: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemi, color: Colors.primaryDark },
  addBtn: {
    marginTop: Spacing.md,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  addBtnText: { fontSize: FontSize.md, fontFamily: FontFamily.bodyBold, color: '#fff' },
  attribution: {
    marginTop: Spacing.md,
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
});
