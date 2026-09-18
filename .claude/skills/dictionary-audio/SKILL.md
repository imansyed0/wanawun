---
name: dictionary-audio
description: Work with Wanwun's Kashmiri dictionary recordings — the Hassan/DSAL clips in Supabase storage, the audio manifest, starter words, and attaching a recording to a word. Use when adding or verifying word audio, changing starter word sets, uploading clips to the course-audio bucket, or debugging a word that has no sound.
---

# Dictionary audio

Where Wanwun's word recordings come from, and how a word gets one.

Paths are relative to the repo root.

## The sources

| Source | What it is | Where it lives |
|---|---|---|
| **S. Hassan dictionary (DSAL)** | Per-word recordings + headwords and English glosses, University of Chicago's Digital South Asia Library | `course-audio/hassan-dictionary/<DSAL id>.mp3`; text in `data/hassan_dictionary_full.csv` |
| **Kaeshir Database** | Romanised transliterations, and Perso-Arabic script | fetched at build time (see below) |
| **koshur.org courses** | Lesson and conversation clips (Kachru, Koul, CIIL) | `course-audio/<Course>/…`, listed in `data/course_audio_manifest.json` |
| **Learner recordings** | What people record themselves, in their own voice | `recordings/<user id>/<word id>.m4a` |

`data/dictionary_audio_manifest.json` lists which DSAL ids are in the bucket — all
**5,999** of them. `src/lib/englishDictionary.ts` turns an id into URLs with
`dictionaryAudioUrls(audioId)`: the bucket first, DSAL as fallback.

**Do not source Hassan from the `mzmmoazam/kashmiri_dataset` mirror.** It holds
1,934 of the dictionary's 6,000 entries, with ids `02000`–`03999` almost entirely
absent, and the pipeline used to inherit exactly that gap — `rūd` (rain), the
ordinary word any speaker would use, was missing while the literary `bə̄riš` was
present. `data/hassan_dictionary_full.csv` is the full dictionary and is what the
build reads now. Most Hugging Face Kashmiri datasets are re-publications of that
same partial mirror, are Perso-Arabic with no romanisation, or are gated.

## Regenerating the dictionary

```bash
node scripts/scrapeHassanDictionary.js                    # -> data/hassan_dictionary_full.csv
node scripts/scrapeHassanDictionary.js --clips ./clips    # + fetch clips not in the manifest
```

The scrape enumerates by headword prefix — the search endpoint has no result cap
or pagination, so `a` alone returns 526 entries and the whole dictionary costs
~50 requests. Two traps that cost entries if you change `PREFIXES`: `ə` (U+0259)
and `ǝ` (U+01DD) are different characters and the dictionary uses **both**, and
one entry begins with `ι`. DSAL's `robots.txt` disallows `/cgi-bin/` (the search
endpoint); `/dictionaries/` (the audio) it does not.

Then rebuild the English index, which needs Kaeshir as well:

```bash
curl -sL -o /tmp/kaeshir.json \
  https://raw.githubusercontent.com/izan-majeed/Kaeshir-Database/main/kashmiri/data/collected-words.json
mkdir -p /tmp/hassan/csv_files && cp data/hassan_dictionary_full.csv /tmp/hassan/csv_files/S_Hassan_dictionary.csv
node scripts/buildEnglishDictionary.js --dataset /tmp/hassan --kaeshir /tmp/kaeshir.json
```

**A recording outranks everything in the index.** `MAX_TRANSLATIONS` is 3, and
Kaeshir entries score higher than Hassan ones, so a silent entry used to push a
recorded one off the list — which is how `rain` ended up showing a Kaeshir
variant list with no audio. The sort now puts entries that have a clip first and
lets score decide only within each group. Every key that has any audio leads with
it (1,191 of 1,191).

## Uploading clips to the bucket

```bash
supabase storage cp -r ./clips ss:///course-audio --experimental -j 8 \
  --content-type audio/mpeg --cache-control max-age=31536000
```

The destination is the **bucket**, not the prefix: `cp -r` appends the source
directory's own name, so `ss:///course-audio/hassan-dictionary` lands everything
at `hassan-dictionary/hassan-dictionary/`. Name the local directory
`hassan-dictionary` and copy to `ss:///course-audio`.

`supabase storage rm` has also been seen reporting `{"deleted":[]}` and removing
nothing. To actually delete, call the Storage API with the service role key from
`supabase projects api-keys --project-ref <ref>`:

```bash
curl -X DELETE "$URL/storage/v1/object/course-audio" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"prefixes":["hassan-dictionary/00001.mp3"]}'
```

## The rule about attaching audio

A word gets the dictionary's recording **only when it was tapped in a lesson**.
Words added with the + button stay silent until someone records them — that is
deliberate: the app is about hearing how *your family* says a word.

- Lesson tap → `TappableEnglishText` passes the translation's `audioId` through
  `QuickAddPrefill` → the quick-add sheet links it with `attachDictionaryClip`
  (`src/services/dictionaryAudioLink.ts`).
- + button → no `audioId` in the prefill → nothing attached.
- Starter words are the exception: `starterGlossaryService` links each set's clips
  when it seeds them.

Note `linkAudioToWord` writes `words.audio_url`, which is the **shared** dictionary
row — not a per-user field. One person attaching a clip sets it for everyone.

## Starter words

`src/services/starterGlossaryService.ts` holds three sets of 15, one per level from
Naani's question. Every entry is `{ kashmiri, english, audioId }` copied verbatim
from the `words` table so the insert links to the existing row.

Seeding runs on the first Glossary load after a level is chosen, once per level per
account (`starterWordsAdded:<user id>` in AsyncStorage), skipping words already in
the glossary.

## Finding words that have a clip

The built index is bundled, so this is offline. Entries are
`[transliteration, part of speech, audioId]`, and 1,828 of 2,554 carry a clip:

```bash
node -e "
const d = require('./data/english_kashmiri_dictionary.json');
const ids = new Set(require('./data/dictionary_audio_manifest.json').ids);
const withAudio = d.entries.filter(e => e[2] && ids.has(e[2]));
console.log(withAudio.length, 'of', d.entries.length, 'entries have a clip in the bucket');
const meaning = {};
for (const [word, positions] of Object.entries(d.index)) for (const p of positions) (meaning[p] ||= []).push(word);
d.entries.forEach((e, i) => { if (e[2] && ids.has(e[2]) && (meaning[i]||[]).includes('smile')) console.log(e, meaning[i]); });
"
```

## Verifying a clip actually exists

The manifest can disagree with the bucket. Check the public URL:

```bash
node -e "
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
fetch(url + '/storage/v1/object/public/course-audio/hassan-dictionary/00325.mp3', { method: 'HEAD' })
  .then(r => console.log(r.status, r.headers.get('content-type'), r.headers.get('content-length'), 'bytes'));
"
```

A healthy clip is a few KB of `audio/mpeg`. Watch for two traps found in the data:

- **Files under ~7 KB** are often silent or truncated.
- **`.m4a` names holding WebM audio**, which iOS cannot play. Check `content-type`,
  not the extension.


## Gotchas

- **`words` rows are shared.** Attaching audio, or adding a word, affects every
  user. Glossary entries live in `lesson_vocab` and point at a `words` row.
- **Duplicate dictionary rows exist.** `addGlossaryWord` orders by `audio_url` with
  nulls last so a word links to the row that has a recording.
- **The dictionary has data errors.** "Boy" glossed as brother, `shukriyā` as snow.
  Check a word's gloss before putting it in front of learners.
- **No `words` row has audio by default.** Only rows someone recorded, or that
  starter seeding linked, have `audio_url` set.
- **Licensing** of the DSAL material is the project owner's call; the Hassan page
  carries no rights statement. The recordings *and* the headword/gloss text both
  come from there — `data/hassan_dictionary_full.csv` is as much DSAL's content as
  the mp3s are.
