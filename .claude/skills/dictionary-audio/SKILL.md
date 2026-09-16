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
| **S. Hassan dictionary (DSAL)** | Per-word recordings, University of Chicago's Digital South Asia Library | `course-audio/hassan-dictionary/<DSAL id>.mp3` in Supabase storage |
| **Kaeshir Database** | Romanised transliterations + which DSAL recording each word has | `data/english_kashmiri_dictionary.json` |
| **koshur.org courses** | Lesson and conversation clips (Kachru, Koul, CIIL) | `course-audio/<Course>/…`, listed in `data/course_audio_manifest.json` |
| **Learner recordings** | What people record themselves, in their own voice | `recordings/<user id>/<word id>.m4a` |

`data/dictionary_audio_manifest.json` lists which DSAL ids are in the bucket.
`src/lib/englishDictionary.ts` turns an id into URLs with
`dictionaryAudioUrls(audioId)`: the bucket first, DSAL as fallback.

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

Both dictionaries are bundled, so this is offline. Entries are
`[transliteration, part of speech, audioId]`:

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

## Uploading new clips

The `course-audio` bucket is public-read with no insert policy, so the app's anon
key cannot write to it. Use the Supabase CLI (must be logged in and linked):

```bash
supabase storage cp ./local.mp3 "ss:///course-audio/tour/example.mp3" \
  --experimental --content-type audio/mpeg --cache-control max-age=31536000
```

Then verify with the HEAD check above. `scripts/uploadCourseAudio.js` and
`scripts/uploadDictionaryAudio.js` do this in bulk and write the manifests.

## Gotchas

- **`words` rows are shared.** Attaching audio, or adding a word, affects every
  user. Glossary entries live in `lesson_vocab` and point at a `words` row.
- **Duplicate dictionary rows exist.** `addGlossaryWord` orders by `audio_url` with
  nulls last so a word links to the row that has a recording.
- **The dictionary has data errors.** "Boy" glossed as brother, `shukriyā` as snow.
  Check a word's gloss before putting it in front of learners.
- **No `words` row has audio by default.** Only rows someone recorded, or that
  starter seeding linked, have `audio_url` set.
- **Licensing** of the DSAL recordings is the project owner's call; the Hassan page
  carries no rights statement.
