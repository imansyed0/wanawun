import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { BorderRadius, Colors, FontFamily, FontSize, LineHeight, Spacing } from '@/src/constants/theme';
import {
  tokenizeKashmiri,
  type DictionaryEntry,
  type TextToken,
} from '@/src/lib/dictionary';
import { WordSheet } from '@/src/components/ui/WordSheet';

/**
 * Distinct tints for multi-word phrases / idiomatic expressions. Each phrase
 * gets a stable colour (hashed from its key) so the same idiom looks the same
 * everywhere and neighbouring idioms are easy to tell apart.
 */
export const PHRASE_COLORS = [
  { text: '#8A4F2A', background: '#F3E3D3' }, // saffron
  { text: '#3F6B5C', background: '#DCEAE3' }, // lake green
  { text: '#4E5F8C', background: '#DFE4F1' }, // dawn blue
  { text: '#8C3F4F', background: '#F2DDE1' }, // chinar red
  { text: '#6B5A1F', background: '#EFE8C8' }, // pashmina gold
];

export function phraseColorFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return PHRASE_COLORS[Math.abs(hash) % PHRASE_COLORS.length];
}

/** Subtle "you can tap this" cue shared by tappable Kashmiri and English words. */
export const knownWordStyle: TextStyle = {
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textDecorationColor: Colors.primaryLight,
};

export interface TappableKashmiriTextProps {
  text: string;
  /** Base style for the whole line (font, size, colour). */
  style?: StyleProp<TextStyle>;
  /**
   * Marks the whole line as active, e.g. while its audio clip plays (WAN-12).
   * `highlightStyle` is merged on top of `style` when true.
   */
  highlighted?: boolean;
  highlightStyle?: StyleProp<TextStyle>;
  /** Per-token style hook, e.g. karaoke-style word highlighting. */
  tokenStyle?: (token: TextToken, index: number) => StyleProp<TextStyle>;
  /** Colour multi-word phrases/idioms. Defaults to true. */
  colorPhrases?: boolean;
  /** Override the built-in definition sheet. */
  onWordPress?: (token: TextToken) => void;
  numberOfLines?: number;
}

/**
 * Renders Kashmiri text where every word is tappable. Tapping shows its
 * dictionary definition in a bottom sheet (or a "no definition" state).
 * Uses nested <Text> so lines still wrap naturally.
 */
export function TappableKashmiriText({
  text,
  style,
  highlighted = false,
  highlightStyle,
  tokenStyle,
  colorPhrases = true,
  onWordPress,
  numberOfLines,
}: TappableKashmiriTextProps) {
  const tokens = useMemo(() => tokenizeKashmiri(text), [text]);
  const [selected, setSelected] = useState<TextToken | null>(null);

  return (
    <>
      <Text
        style={[style, highlighted && highlightStyle]}
        numberOfLines={numberOfLines}
      >
        {tokens.map((token, idx) => {
          if (!token.isWord) return token.text;

          const phraseColor =
            colorPhrases && token.entry?.isPhrase ? phraseColorFor(token.entry.key) : null;

          return (
            <Text
              key={`${idx}-${token.text}`}
              onPress={() => (onWordPress ? onWordPress(token) : setSelected(token))}
              suppressHighlighting={false}
              accessibilityRole="button"
              accessibilityHint="Shows the definition"
              style={[
                token.entry && knownWordStyle,
                phraseColor && {
                  color: phraseColor.text,
                  backgroundColor: phraseColor.background,
                },
                tokenStyle?.(token, idx),
              ]}
            >
              {token.text}
            </Text>
          );
        })}
      </Text>
      {!onWordPress && (
        <WordDefinitionSheet token={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

interface WordDefinitionSheetProps {
  token: TextToken | null;
  onClose: () => void;
}

export function WordDefinitionSheet({ token, onClose }: WordDefinitionSheetProps) {
  if (!token) return null;
  const entry: DictionaryEntry | null = token.entry;
  const phraseColor = entry?.isPhrase ? phraseColorFor(entry.key) : null;

  return (
    <WordSheet visible onClose={onClose} closeLabel="Close definition">
      <Text style={styles.word}>{token.text}</Text>
      {entry && entry.headword.toLowerCase() !== token.text.toLowerCase() ? (
        <Text style={styles.headword}>Dictionary form: {entry.headword}</Text>
      ) : null}
      {phraseColor ? (
        <View style={[styles.badge, { backgroundColor: phraseColor.background }]}>
          <Text style={[styles.badgeText, { color: phraseColor.text }]}>
            Phrase / idiom
          </Text>
        </View>
      ) : null}

      {entry ? (
        entry.senses.map((sense, idx) => (
          <View key={`${sense.english}-${idx}`} style={styles.senseRow}>
            <Text style={styles.senseNumber}>{entry.senses.length > 1 ? `${idx + 1}.` : ''}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.senseEnglish}>{sense.english}</Text>
              {sense.partOfSpeech && sense.partOfSpeech !== 'other' ? (
                <Text style={styles.senseMeta}>{sense.partOfSpeech}</Text>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>
          No definition found yet. Try the glossary, or listen to the clip for context.
        </Text>
      )}
    </WordSheet>
  );
}

const styles = StyleSheet.create({
  word: {
    fontFamily: FontFamily.kashmiri,
    fontSize: FontSize.xl,
    lineHeight: LineHeight.kashmiri(FontSize.xl),
    color: Colors.accent,
  },
  headword: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginBottom: Spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemi,
  },
  senseRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
  },
  senseNumber: {
    width: 22,
    fontSize: FontSize.md,
    color: Colors.textLight,
  },
  senseEnglish: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.text,
    fontFamily: FontFamily.bodySemi,
  },
  senseMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  empty: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.textSecondary,
    marginVertical: Spacing.sm,
  },
});
