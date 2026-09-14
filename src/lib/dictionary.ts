/**
 * Offline Kashmiri → English lookup used by tap-to-define text (WAN-13).
 *
 * Sources (bundled, no network needed):
 *  - data/glossary.json — the parsed Kashmiri glossary (same rows seeded into
 *    the Supabase `words` table). Uses diacritic romanisation: ā ē ī ō ū ə.
 *  - data/ciil_structured_context.json — CIIL lesson tables such as
 *    "mo:l - father". CIIL uses an ASCII scheme (a: = ā, I = ə, T/D retroflex).
 *
 * Both schemes are folded to a shared "skeleton" key so `mo:l`, `mōl` and
 * `Mol` all resolve to the same entry.
 */

export type DictionarySource = 'glossary' | 'ciil';

export interface DictionarySense {
  english: string;
  partOfSpeech?: string;
  source: DictionarySource;
}

export interface DictionaryEntry {
  key: string;
  /** Headword as written in the first source that defined it. */
  headword: string;
  senses: DictionarySense[];
  /** Multi-word entry (phrase / idiomatic expression). */
  isPhrase: boolean;
}

export interface TextToken<E = DictionaryEntry> {
  /** Raw text of the token, exactly as it appears in the source string. */
  text: string;
  /** True for words (tappable); false for whitespace/punctuation. */
  isWord: boolean;
  /** Dictionary entry, when the word (or phrase) was found. */
  entry: E | null;
}

interface GlossaryRow {
  kashmiri: string;
  english: string;
  part_of_speech?: string;
}

interface CiilContext {
  sections?: { title: string; items: string[] }[];
}

const MAX_PHRASE_WORDS = 4;
const DIACRITICS = /[̀-ͯ]/g;
const ROMANISED_DIACRITIC = /[āēīōūəṇ]/i;

/** Fold any romanisation of a Kashmiri word to a comparable key. */
export function foldKashmiri(text: string): string {
  return text
    .normalize('NFC')
    .replace(/ə/g, 'i')
    .replace(/I/g, 'i') // CIIL capital I is the central vowel ə
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[:~‘’'`ʼ]/g, '') // length marks, nasalisation, palatal apostrophes
    .replace(/[0-9]+$/g, '')
    .replace(/(.)\1+/g, '$1') // CIIL sometimes doubles long vowels (paav)
    .replace(/\s+/g, ' ')
    .trim();
}

let index: Map<string, DictionaryEntry> | null = null;

function addEntry(
  map: Map<string, DictionaryEntry>,
  headword: string,
  sense: DictionarySense
) {
  const cleanHeadword = headword.replace(/\[|\]/g, '').replace(/\(.*?\)/g, '').trim();
  const key = foldKashmiri(cleanHeadword);
  const english = sense.english.trim();
  if (!key || !english || /^\d+$/.test(key)) return;

  const existing = map.get(key);
  if (existing) {
    const seen = existing.senses.some(
      (s) => s.english.toLowerCase() === english.toLowerCase()
    );
    if (!seen) existing.senses.push({ ...sense, english });
    return;
  }

  map.set(key, {
    key,
    headword: cleanHeadword,
    senses: [{ ...sense, english }],
    isPhrase: key.includes(' '),
  });
}

function buildIndex(): Map<string, DictionaryEntry> {
  const map = new Map<string, DictionaryEntry>();

  const glossary = require('../../data/glossary.json') as { words: GlossaryRow[] };
  for (const row of glossary.words) {
    let kashmiri = row.kashmiri ?? '';
    let english = row.english ?? '';
    // A handful of parsed rows have the columns swapped
    // (e.g. kashmiri: "advance payment, deposit", english: "pōpar").
    if (ROMANISED_DIACRITIC.test(english) && !ROMANISED_DIACRITIC.test(kashmiri)) {
      [kashmiri, english] = [english, kashmiri];
    }
    // Glossary entries sometimes list variants: "hu/su".
    for (const variant of kashmiri.split('/')) {
      addEntry(map, variant, {
        english,
        partOfSpeech: row.part_of_speech,
        source: 'glossary',
      });
    }
  }

  const ciil = require('../../data/ciil_structured_context.json') as CiilContext[];
  for (const lesson of ciil) {
    for (const section of lesson.sections ?? []) {
      for (const item of section.items) {
        const parts = item.split(' - ');
        if (parts.length < 2) continue;
        const left = stripSpeakerPrefix(parts[0]);
        // "31 - akItrIh - Thirty one": numeral, Kashmiri, English.
        if (/^\d+$/.test(left.trim()) && parts.length >= 3) {
          addEntry(map, parts[1], { english: parts.slice(2).join(' - '), source: 'ciil' });
          continue;
        }
        // Skip long sentences: they are translations, not dictionary entries.
        if (left.trim().split(/\s+/).length > MAX_PHRASE_WORDS) continue;
        for (const variant of left.split('/')) {
          addEntry(map, variant.replace(/[?.!,]/g, ''), {
            english: parts.slice(1).join(' - '),
            source: 'ciil',
          });
        }
      }
    }
  }

  return map;
}

function getIndex() {
  if (!index) index = buildIndex();
  return index;
}

/** Removes a dialogue speaker label such as "A: " or "M: ". */
export function stripSpeakerPrefix(text: string) {
  return text.replace(/^\s*[A-Z]{1,2}:\s+/, '');
}

export function lookupKashmiri(text: string): DictionaryEntry | null {
  const key = foldKashmiri(text.replace(/^[^\p{L}]+|[^\p{L}:~’‘']+$/gu, ''));
  if (!key) return null;
  return getIndex().get(key) ?? null;
}

// Words keep internal length marks / apostrophes (a:, ri~:Th, p’on);
// everything else (spaces, punctuation) becomes a separator token.
const TOKEN_PATTERN = /[\p{L}\p{M}0-9:~’‘'ʼ-]+|[^\p{L}\p{M}0-9:~’‘'ʼ-]+/gu;

function isWordToken(raw: string) {
  return /\p{L}/u.test(raw);
}

export interface PhraseTokenizerOptions<E> {
  /** Global regex whose matches alternate word runs and separator runs. */
  pattern: RegExp;
  isWord: (raw: string) => boolean;
  maxPhraseWords: number;
  lookupPhrase: (span: string) => E | null;
  lookupWord: (word: string) => E | null;
}

/**
 * Split text into tokens, greedily matching multi-word dictionary phrases
 * (longest first, up to maxPhraseWords) before single words. Shared by the
 * Kashmiri (WAN-13) and English (WAN-53) tappable text.
 */
export function tokenizeWithPhrases<E>(
  text: string,
  { pattern, isWord, maxPhraseWords, lookupPhrase, lookupWord }: PhraseTokenizerOptions<E>
): TextToken<E>[] {
  const raw = text.match(pattern) ?? [];
  const tokens: TextToken<E>[] = [];

  let i = 0;
  while (i < raw.length) {
    const piece = raw[i];
    if (!isWord(piece)) {
      tokens.push({ text: piece, isWord: false, entry: null });
      i += 1;
      continue;
    }

    // Try phrases: word, space, word, ... (only plain-whitespace joins).
    let matched = false;
    for (let words = maxPhraseWords; words >= 2; words -= 1) {
      const end = i + (words - 1) * 2; // index of the last word in the span
      if (end >= raw.length) continue;
      let ok = true;
      for (let j = i + 1; j < end; j += 2) {
        if (!/^\s+$/.test(raw[j]) || !isWord(raw[j + 1])) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const span = raw.slice(i, end + 1).join('');
      const entry = lookupPhrase(span);
      if (entry) {
        tokens.push({ text: span, isWord: true, entry });
        i = end + 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    tokens.push({ text: piece, isWord: true, entry: lookupWord(piece) });
    i += 1;
  }

  return tokens;
}

export function tokenizeKashmiri(text: string): TextToken[] {
  const dict = getIndex();
  return tokenizeWithPhrases(text, {
    pattern: TOKEN_PATTERN,
    isWord: isWordToken,
    maxPhraseWords: MAX_PHRASE_WORDS,
    lookupPhrase: (span) => dict.get(foldKashmiri(span)) ?? null,
    lookupWord: lookupKashmiri,
  });
}
