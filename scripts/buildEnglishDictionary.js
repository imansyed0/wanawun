// Builds data/english_kashmiri_dictionary.json (WAN-53): an offline
// English → Kashmiri index used to make English words in lesson translations
// tappable. Source: https://github.com/mzmmoazam/kashmiri_dataset
//
//   git clone --depth 1 https://github.com/mzmmoazam/kashmiri_dataset /tmp/kashmiri_dataset
//   curl -sL -o /tmp/kaeshir-collected-words.json \
//     https://raw.githubusercontent.com/izan-majeed/Kaeshir-Database/main/kashmiri/data/collected-words.json
//   node scripts/buildEnglishDictionary.js --dataset /tmp/kashmiri_dataset \
//     --kaeshir /tmp/kaeshir-collected-words.json [--all] [--with-zabaan]
//
// Kaeshir Database (github.com/izan-majeed/Kaeshir-Database, MIT) is the main
// source: English headwords with romanised Kashmiri and Perso-Arabic script.
// When a Kaeshir spelling matches a Hassan headword for the same English word,
// the two are merged so the entry also plays the DSAL recording.
//
// Inputs (kashmiri_dataset csv_files/):
//  - S_Hassan_dictionary.csv  Sheeba Hassan's Kashmiri-English dictionary
//    (DSAL, U. Chicago). Romanised headword, comma-separated English glosses,
//    and a DSAL audio id per row (…/hassan/audio//00002.mp3 -> "00002").
//  - kashmiri_zabaan.csv      kashmirizabaan.com English → Kashmiri word list.
//    One English lemma per row, Kashmiri in Perso-Arabic script, no audio.
//
// By default the index is pruned to keys that actually match the English
// translations shown in lessons, which keeps the bundled JSON small. Pass
// --all to keep every key. Matching rules below must stay in sync with
// src/lib/englishDictionary.ts.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data/english_kashmiri_dictionary.json');
const MAX_PHRASE_WORDS = 4;
const MAX_TRANSLATIONS = 3;

// Function words that should never become tappable on their own. Many have
// dataset rows ("the" -> سۄ, "in" buried in a gloss list) but those are not
// meaningful translations of the English word in context.
const STOPWORDS = [
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'into', 'onto',
  'and', 'or', 'but', 'if', 'as', 'so', 'than', 'then', 'that', 'this', 'these',
  'those', 'it', "it's", 'its', 'do', 'does', 'did', 'have', 'has', 'had',
  'will', 'shall', 'would', 'should', 'can', 'could', 'may', 'might', 'must',
  'not', 'no', 'up', 'out', 'off', 'about', 'over', 'just', 'very', 'too',
  'i', "i'm", 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his',
  'she', 'her', 'hers', 'we', 'us', 'our', 'they', 'them', 'their', 'there',
  'here', 'one', 's', 'oh', 'also', 'some', 'any', 'all', 'let', "let's",
  // Too ambiguous in running text to show one translation for.
  'like', 'even', 'other', 'each', 'well', 'get', 'got',
];
const STOP = new Set(STOPWORDS);

const ZABAAN_POS = {
  N: 'n.', Adj: 'adj.', V: 'v.', VT: 'v.', VI: 'v.', VTI: 'v.', Adv: 'adv.',
  Prep: 'prep.', Pron: 'pron.', Det: 'det.', Conj: 'conj.', Art: 'art.',
  Part: 'part.', Interj: 'interj.', 'Rel Pron': 'pron.',
};

const KAESHIR_POS = {
  noun: 'n.', 'plural noun': 'n.', adjective: 'adj.', adj: 'adj.', verb: 'v.',
  'auxiliary verb': 'v.', adverb: 'adv.', 'adverb or adjective': 'adv.',
  pronoun: 'pron.', 'plural pronoun': 'pron.', preposition: 'prep.', conjunction: 'conj.',
};

// Loose spelling key for spotting the same Kashmiri word across
// romanisations, e.g. Hassan "asbāb" and Kaeshir "Asba:b".
function foldRoman(word) {
  return word
    .normalize('NFD')
    .toLowerCase()
    .replace(/ʦ/g, 'ts')
    .replace(/ʰ/g, 'h')
    .replace(/ə/g, 'a')
    .replace(/[ɨι]/g, 'i')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

// Minimal RFC 4180 parser (quoted fields may contain commas and newlines).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// --- Matching rules (mirror of src/lib/englishDictionary.ts) ---------------

function normalizeEnglish(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[-‐–—/]/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '');
}

// The word itself, then plausible dictionary forms (plural, past, -ing).
function wordCandidates(key) {
  const out = [key];
  if (key.includes(' ') || key.length <= 3 || STOP.has(key)) return out;
  if (key.endsWith("'s")) out.push(key.slice(0, -2));
  if (key.endsWith('ies')) out.push(`${key.slice(0, -3)}y`);
  if (key.endsWith('es')) out.push(key.slice(0, -2));
  if (key.endsWith('s') && !key.endsWith('ss')) out.push(key.slice(0, -1));
  if (key.endsWith('ied')) out.push(`${key.slice(0, -3)}y`);
  if (key.endsWith('ed')) out.push(key.slice(0, -2), key.slice(0, -1));
  if (key.endsWith('ing') && key.length > 5) out.push(key.slice(0, -3), `${key.slice(0, -3)}e`);
  return [...new Set(out)].filter((k) => k.length >= 3 && !STOP.has(k));
}

const TOKEN_PATTERN = /[\p{L}\p{M}0-9'’-]+|[^\p{L}\p{M}0-9'’-]+/gu;
const isWord = (raw) => /\p{L}/u.test(raw);

function tokenize(text, index) {
  const raw = text.match(TOKEN_PATTERN) ?? [];
  const tokens = [];
  let i = 0;
  while (i < raw.length) {
    if (!isWord(raw[i])) {
      i += 1;
      continue;
    }
    let matched = false;
    for (let words = MAX_PHRASE_WORDS; words >= 2; words -= 1) {
      const end = i + (words - 1) * 2;
      if (end >= raw.length) continue;
      let ok = true;
      for (let j = i + 1; j < end; j += 2) {
        if (!/^\s+$/.test(raw[j]) || !isWord(raw[j + 1])) ok = false;
      }
      if (!ok) continue;
      const key = normalizeEnglish(raw.slice(i, end + 1).join(''));
      if (index.has(key)) {
        tokens.push({ words, key });
        i = end + 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const norm = normalizeEnglish(raw[i]);
    const key = wordCandidates(norm).find((k) => index.has(k)) ?? null;
    tokens.push({ words: 1, key, stop: STOP.has(norm) || !norm });
    i += 1;
  }
  return tokens;
}

// --- Dataset -> keyed translations ------------------------------------------

function isUsableKey(key) {
  if (!key || !/[a-z]/.test(key)) return false;
  const words = key.split(' ');
  if (words.length > MAX_PHRASE_WORDS) return false;
  if (words.every((w) => STOP.has(w))) return false;
  return true;
}

function cleanGloss(gloss) {
  return normalizeEnglish(
    gloss
      .replace(/\(.*?\)/g, ' ')
      .replace(/^\s*to\s+/i, '')
      .replace(/[?!."]/g, ' ')
  ).replace(/^to /, '');
}

function loadHassan(dataset) {
  const rows = parseCsv(fs.readFileSync(path.join(dataset, 'csv_files/S_Hassan_dictionary.csv'), 'utf8'));
  const out = [];
  for (const row of rows) {
    const audioId = row.file_urls.match(/(\d+)\.mp3$/)?.[1] ?? '';
    // Some meanings start with a second part of speech: "& adj. good, …".
    const meaning = row.meaning.replace(/^\s*&\s*[a-z.]+\s*/i, '');
    const glosses = meaning.split(/[,;]/).map(cleanGloss).filter(Boolean);
    const entry = { roman: row.word.normalize('NFC').trim(), arabic: '', pos: row.category.trim(), audioId };
    glosses.forEach((key, position) => {
      if (!isUsableKey(key)) return;
      // Earlier glosses are the headword's primary sense; long gloss lists are vague.
      const score = 3 - Math.min(position, 2) * 0.5 - (glosses.length > 6 ? 0.5 : 0);
      out.push({ key, entry, score });
    });
  }
  return { rows: rows.length, keyed: out };
}

function loadZabaan(dataset) {
  const rows = parseCsv(fs.readFileSync(path.join(dataset, 'csv_files/kashmiri_zabaan.csv'), 'utf8'));
  const out = [];
  for (const row of rows) {
    const key = cleanGloss(row.englishMeaning);
    const arabic = row.headword
      .replace(/\s*،\s*/g, '، ')
      .replace(/^[\s،]+|[\s،]+$/g, '')
      .trim();
    if (!arabic || !isUsableKey(key)) continue;
    out.push({
      key,
      entry: { roman: '', arabic, pos: ZABAAN_POS[row.category.trim()] ?? '', audioId: '' },
      score: 2.6,
    });
  }
  return { rows: rows.length, keyed: out };
}

// Kaeshir Database kashmiri/data/collected-words.json: one English headword
// per row, romanised Kashmiri ("Cha:la:k, La:iki-ka:r") and Perso-Arabic script.
function loadKaeshir(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  for (const row of rows) {
    const key = cleanGloss(row.title ?? '');
    const roman = (row.englishMeaning ?? '').replace(/\s+/g, ' ').trim();
    const arabic = (row.kashmiriMeaning ?? '')
      .replace(/\s*[،,]\s*/g, '، ')
      .replace(/^[\s،]+|[\s،]+$/g, '')
      .trim();
    if (!roman || roman === '-' || !isUsableKey(key)) continue;
    const posName = (row.pos ?? '').split(',').slice(1).join(',').trim().toLowerCase();
    out.push({
      key,
      entry: { roman, arabic: arabic === '-' ? '' : arabic, pos: KAESHIR_POS[posName] ?? posName, audioId: '' },
      score: 3.5,
    });
  }
  return { rows: rows.length, keyed: out };
}

// --- Lesson English text ----------------------------------------------------

function lessonTexts() {
  const groups = { 'spoken-kashmiri': [], ciil: [], 'learn-kashmiri (hidden)': [] };
  for (const ch of require(path.join(ROOT, 'data/spoken_kashmiri_content.json'))) {
    for (const ex of ch.exchanges) groups['spoken-kashmiri'].push(ex.english);
  }
  for (const lesson of require(path.join(ROOT, 'data/ciil_structured_context.json'))) {
    for (const section of lesson.sections ?? []) {
      const isTable = section.items.length > 0 && section.items.every((it) => it.includes(' - '));
      const isDialogue = /dialogue|conversation/i.test(section.title);
      for (const item of section.items) {
        if (isTable || isDialogue) {
          const english = item.split(' - ').slice(1).join(' - ');
          if (english) groups.ciil.push(english);
        }
      }
    }
  }
  for (const ctx of require(path.join(ROOT, 'data/course_context.json'))) {
    if (ctx.courseId !== 'learn-kashmiri' || ctx.htmlContent) continue;
    for (const section of ctx.sections ?? []) groups['learn-kashmiri (hidden)'].push(...section.items);
  }
  return groups;
}

function main() {
  const dataset = arg('--dataset') ?? process.env.KASHMIRI_DATASET_DIR;
  if (!dataset || !fs.existsSync(path.join(dataset, 'csv_files'))) {
    console.error('usage: node scripts/buildEnglishDictionary.js --dataset <kashmiri_dataset clone> [--all]');
    process.exit(1);
  }

  // Kaeshir rows (romanised + script) first, then DSAL (Hassan) entries, which
  // are romanised with a recording. kashmirizabaan.com rows are script only
  // with no audio, so they're left out unless --with-zabaan is passed.
  const kaeshirFile = arg('--kaeshir') ?? process.env.KAESHIR_WORDS_FILE;
  if (!kaeshirFile) console.warn('No --kaeshir file given: building from DSAL (Hassan) entries only.');
  const kaeshir = kaeshirFile ? loadKaeshir(kaeshirFile) : { rows: 0, keyed: [] };
  const hassan = loadHassan(dataset);
  const zabaan = process.argv.includes('--with-zabaan') ? loadZabaan(dataset) : { rows: 0, keyed: [] };
  const byKey = new Map();
  for (const item of [...kaeshir.keyed, ...hassan.keyed, ...zabaan.keyed]) {
    if (!byKey.has(item.key)) byKey.set(item.key, []);
    byKey.get(item.key).push(item);
  }
  let mergedAudio = 0;
  for (const [key, items] of byKey) {
    // A Kaeshir row that spells the same word as a Hassan headword takes over
    // its recording, and the separate Hassan entry is dropped.
    const recorded = items.filter(({ entry }) => entry.audioId);
    const absorbed = new Set();
    const merged = items.map((item) => {
      if (item.entry.audioId || !item.entry.arabic || !item.entry.roman) return item;
      const variants = new Set(
        item.entry.roman
          .split(',')
          .map((v) => foldRoman(v.replace(/\(.*?\)/g, '')))
          .filter(Boolean)
      );
      const match = recorded.find((r) => !absorbed.has(r) && variants.has(foldRoman(r.entry.roman)));
      if (!match) return item;
      absorbed.add(match);
      mergedAudio += 1;
      return { ...item, entry: { ...item.entry, audioId: match.entry.audioId } };
    });
    const seen = new Set();
    const ranked = merged
      // Only romanised entries are shown; Perso-Arabic script never is.
      .filter((item) => !absorbed.has(item) && item.entry.roman)
      .sort((a, b) => b.score - a.score)
      .filter(({ entry }) => {
        const id = entry.roman || entry.arabic;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, MAX_TRANSLATIONS);
    if (ranked.length) byKey.set(key, ranked);
    else byKey.delete(key);
  }

  // Coverage over lesson translations, and the set of keys lessons use.
  const used = new Set();
  const stats = {};
  for (const [group, texts] of Object.entries(lessonTexts())) {
    const s = { lines: texts.length, linesWithMatch: 0, words: 0, contentWords: 0, matchedWords: 0, phraseMatches: 0, withAudio: 0 };
    const distinct = new Set();
    for (const text of texts) {
      const tokens = tokenize(text, byKey);
      let lineMatched = false;
      for (const t of tokens) {
        s.words += t.words;
        if (!t.stop || t.key) s.contentWords += t.words;
        if (!t.key) continue;
        lineMatched = true;
        used.add(t.key);
        distinct.add(t.key);
        s.matchedWords += t.words;
        if (t.words > 1) s.phraseMatches += 1;
        if (byKey.get(t.key).some(({ entry }) => entry.audioId)) s.withAudio += 1;
      }
      if (lineMatched) s.linesWithMatch += 1;
    }
    s.distinctKeys = distinct.size;
    s.contentWordCoverage = s.contentWords ? `${((100 * s.matchedWords) / s.contentWords).toFixed(1)}%` : 'n/a';
    stats[group] = s;
  }

  const keepAll = process.argv.includes('--all');
  const keys = [...byKey.keys()].filter((k) => keepAll || used.has(k)).sort();
  const entries = [];
  const entryIds = new Map();
  const index = {};
  for (const key of keys) {
    index[key] = byKey.get(key).map(({ entry }) => {
      const id = `${entry.roman}|${entry.pos}|${entry.audioId}`;
      if (!entryIds.has(id)) {
        entryIds.set(id, entries.length);
        entries.push([entry.roman, entry.pos, entry.audioId]);
      }
      return entryIds.get(id);
    });
  }

  const output = {
    source: [
      kaeshir.keyed.length && 'https://github.com/izan-majeed/Kaeshir-Database (kashmiri/data/collected-words.json)',
      `https://github.com/mzmmoazam/kashmiri_dataset (csv_files/S_Hassan_dictionary.csv${zabaan.keyed.length ? ', csv_files/kashmiri_zabaan.csv' : ''})`,
    ]
      .filter(Boolean)
      .join('; '),
    generatedBy: 'scripts/buildEnglishDictionary.js',
    maxPhraseWords: MAX_PHRASE_WORDS,
    stopwords: STOPWORDS,
    // [romanised Kashmiri, part of speech, DSAL audio id ('' when none)]
    entries,
    index,
  };
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(output)}\n`);

  console.log(`Kaeshir rows: ${kaeshir.rows} (${kaeshir.keyed.length} usable, ${mergedAudio} merged with a DSAL recording)`);
  console.log(`Hassan rows: ${hassan.rows} (${hassan.keyed.length} English glosses)`);
  console.log(`Zabaan rows: ${zabaan.rows} (${zabaan.keyed.length} usable)`);
  console.log(`English keys available: ${byKey.size} (${[...byKey.keys()].filter((k) => k.includes(' ')).length} multi-word)`);
  console.log(`Keys written: ${keys.length}, entries: ${entries.length}, ${(fs.statSync(OUT_PATH).size / 1024).toFixed(1)} KB -> ${path.relative(ROOT, OUT_PATH)}`);
  console.table(stats);
}

main();
