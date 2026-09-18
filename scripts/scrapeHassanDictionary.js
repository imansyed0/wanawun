// Builds data/hassan_dictionary_full.csv: every entry of S. Hassan's
// "A Pronouncing Dictionary of Kashmiri Language" (DSAL, U. Chicago), with the
// DSAL id of its recording.
//
//   node scripts/scrapeHassanDictionary.js                  # write the CSV
//   node scripts/scrapeHassanDictionary.js --clips ./clips  # also fetch clips
//                                                           # missing from the manifest
//
// Why this exists: the pipeline used to source Hassan from a third-party mirror
// (github.com/mzmmoazam/kashmiri_dataset, csv_files/S_Hassan_dictionary.csv),
// which turned out to hold only 1,934 of the dictionary's 6,000 entries, with
// ids 02000-03999 almost entirely absent. Words as ordinary as `rūd` (rain)
// were missing, so nothing in the app could say them. This reads the dictionary
// itself, and the CSV it writes is a drop-in replacement for the mirror's:
//
//   node scripts/buildEnglishDictionary.js --dataset <dir> --kaeshir <file>
//
// where <dir>/csv_files/S_Hassan_dictionary.csv is this file.
//
// On politeness: the search endpoint sits under /cgi-bin/, which DSAL's
// robots.txt disallows. Enumerating by headword prefix keeps this to ~50
// requests for the whole dictionary (there is no result cap or pagination —
// `a` alone returns 526 entries), rather than one request per word. Clip
// downloads hit /dictionaries/, which robots.txt does not disallow.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data/hassan_dictionary_full.csv');
const MANIFEST_PATH = path.join(ROOT, 'data/dictionary_audio_manifest.json');
const QUERY_URL = 'https://dsal.uchicago.edu/cgi-bin/app/hassan_query.py';
const AUDIO_BASE = 'https://dsal.uchicago.edu/dictionaries/hassan/audio/';
const UA = 'wanwun-lexicon/1.0 (Kashmiri learning app)';
const PAUSE_MS = 2000;

// Latin letters, then the initial characters the romanisation uses that are not
// a-z. Note `ə` (U+0259) and `ǝ` (U+01DD) are different characters and the
// dictionary uses both: dropping either loses ~45 entries.
const PREFIXES = [
  ...'abcdefghijklmnopqrstuvwxyz',
  'ə', 'ǝ', 'ā', 'ī', 'ū', 'ō', 'ē', 'ʦ', 'ṭ', 'ḍ', 'š', 'ι',
];

const BLOCK_RE = /<div class='container mb-3 rounded border shadow-sm py-3'>([\s\S]*?)<\/div>/g;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function unescapeHtml(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** One search results page -> [{ audioId, headword, pos, meaning }]. */
function parsePage(page) {
  const out = [];
  for (const [, block] of page.matchAll(BLOCK_RE)) {
    const audio = block.match(/audio\/+(\d+)\.mp3/);
    const head = block.match(/\d+\)\s*([\s\S]*?)\s*<audio/) || block.match(/\d+\)\s*([\s\S]*?)\s*(?:<a|$)/);
    // Part of speech and glosses follow the audio control.
    const tail = unescapeHtml(block.split('</a>').pop().replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const split = tail.match(/^((?:[a-z]+\.\s*)+(?:[mf]\.\s*)?)\s*(.*)$/);
    out.push({
      audioId: audio ? audio[1] : '',
      headword: head ? unescapeHtml(head[1].replace(/<[^>]+>/g, '')).trim() : '',
      pos: split ? split[1].trim() : '',
      meaning: split ? split[2].trim() : tail,
    });
  }
  return out;
}

async function fetchPrefix(prefix) {
  const qs = new URLSearchParams({ qs: prefix, searchhws: 'yes', matchtype: 'default' });
  const res = await fetch(`${QUERY_URL}?${qs}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parsePage(await res.text());
}

function toCsv(entries) {
  const quote = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = 'category,domain_name,file_name,file_urls,files,meaning,word';
  const rows = entries.map((e) =>
    [
      e.pos,
      'uchicago_S_Hassan',
      `${e.headword}.mp3`,
      `${AUDIO_BASE}${e.audioId}.mp3`,
      '',
      e.meaning,
      e.headword,
    ].map(quote).join(',')
  );
  return `${header}\n${rows.join('\n')}\n`;
}

async function downloadClips(entries, dir) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const have = new Set(manifest.ids);
  const need = entries.map((e) => e.audioId).filter((id) => id && !have.has(id));
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\nclips to fetch: ${need.length}`);
  let done = 0;
  const failed = [];
  const queue = [...need];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (queue.length) {
        const id = queue.shift();
        const file = path.join(dir, `${id}.mp3`);
        try {
          if (fs.existsSync(file) && fs.statSync(file).size > 500) continue;
          const res = await fetch(`${AUDIO_BASE}${id}.mp3`, { headers: { 'User-Agent': UA } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          // A few DSAL ids serve a near-empty file; those are not real clips.
          if (buf.length < 500) throw new Error(`too small (${buf.length}B)`);
          fs.writeFileSync(file, buf);
        } catch (err) {
          failed.push(id);
        }
        if ((done += 1) % 500 === 0) console.log(`  ${done}/${need.length}`);
        await sleep(60);
      }
    })
  );
  console.log(`fetched ${need.length - failed.length}, failed ${failed.length}`);
  if (failed.length) console.log(`  failed ids: ${failed.slice(0, 20).join(', ')}`);
  console.log(`\nUpload with (note the destination is the BUCKET, not the prefix —`);
  console.log(`\`cp -r\` appends the source directory name):\n`);
  console.log(
    `  supabase storage cp -r "${path.resolve(dir)}" ss:///course-audio --experimental -j 8 \\\n` +
      `    --content-type audio/mpeg --cache-control max-age=31536000`
  );
}

async function main() {
  const byId = new Map();
  for (const prefix of PREFIXES) {
    let rows;
    try {
      rows = await fetchPrefix(prefix);
    } catch (err) {
      console.log(`  ${prefix}: ERROR ${err.message}`);
      continue;
    }
    let added = 0;
    for (const row of rows) {
      if (row.audioId && !byId.has(row.audioId)) added += 1;
      if (row.audioId) byId.set(row.audioId, row);
    }
    console.log(`  ${prefix}: ${String(rows.length).padStart(4)} results, ${String(added).padStart(4)} new (total ${byId.size})`);
    await sleep(PAUSE_MS);
  }

  const entries = [...byId.values()].sort((a, b) => a.audioId.localeCompare(b.audioId));
  fs.writeFileSync(OUT_PATH, toCsv(entries));
  console.log(`\nWrote ${path.relative(ROOT, OUT_PATH)}: ${entries.length} entries`);

  const clipDir = process.argv[process.argv.indexOf('--clips') + 1];
  if (process.argv.includes('--clips') && clipDir) await downloadClips(entries, clipDir);
}

main();
