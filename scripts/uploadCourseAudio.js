// Moves scraped course audio from data/audio/ into the `course-audio` Supabase
// Storage bucket, keyed by the same path koshur.org serves each clip from
// (e.g. "SpokenKashmiri/Chapter1/audio/conv1a.mp3"). The app swaps koshur.org
// for the bucket only for keys listed in data/course_audio_manifest.json, so
// clips we have no local copy of keep streaming from koshur.org.
//
//   node scripts/uploadCourseAudio.js           report coverage, write manifest, stage files
//   supabase storage cp -r ... (commands printed by the step above)
//   node scripts/uploadCourseAudio.js --verify  HEAD every manifest object in the bucket

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'data/audio');
const MANIFEST_PATH = path.join(ROOT, 'data/course_audio_manifest.json');
const REPORT_PATH = path.join(ROOT, 'data/check_spoken_audio_report.json');
const STAGE_DIR = path.join(os.tmpdir(), 'course-audio-stage');
const BUCKET = 'course-audio';

function extractArraySource(source, name) {
  const start = source.indexOf(`const ${name}`);
  if (start === -1) throw new Error(`Missing ${name}`);
  const open = source.indexOf('[', source.indexOf('=', start));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`Unclosed array for ${name}`);
}

// Every koshur.org audio path the app can request, mirroring src/data/courses.ts.
function referencedKeys() {
  const keys = new Set();
  const coursesSource = fs.readFileSync(path.join(ROOT, 'src/data/courses.ts'), 'utf8');

  const spoken = vm.runInNewContext(extractArraySource(coursesSource, 'spokenKashmiriChapters'));
  for (const ch of spoken) {
    for (const clip of ch.clips) keys.add(`SpokenKashmiri/Chapter${ch.n}/audio/${clip}.mp3`);
  }
  for (const ch of require(path.join(ROOT, 'data/kachru_vocabulary.json'))) {
    for (const group of ch.groups) {
      for (const item of group.items) keys.add(`SpokenKashmiri/Chapter${ch.chapter}/audio/${item.audio}`);
    }
  }
  for (const ch of require(path.join(ROOT, 'data/koul_content.json'))) {
    for (const pairs of Object.values(ch.sections)) {
      for (const pair of pairs) keys.add(`Kashmiri/chapter${ch.chapter}/${ch.audioPrefix}${pair.audio}`);
    }
  }
  for (let i = 1; i <= 41; i += 1) keys.add(`ciil/audio/prog${i}.mp3`);
  return keys;
}

// Local crawler layout -> koshur.org path. LearnKashmiri was saved flat, so it
// can't be matched to per-chapter clips (and that course is hidden anyway).
function keyForLocalFile(rel) {
  let m;
  if ((m = rel.match(/^SpokenKashmiri\/(Chapter\d+)\/([^/]+\.mp3)$/))) return `SpokenKashmiri/${m[1]}/audio/${m[2]}`;
  if ((m = rel.match(/^Kashmiri\/(chapter\d+)\/([^/]+\.mp3)$/))) return `Kashmiri/${m[1]}/audio/${m[2]}`;
  if ((m = rel.match(/^CIIL\/(prog\d+\.mp3)$/))) return `ciil/audio/${m[1]}`;
  return null;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Sizes koshur.org reported for Spoken Kashmiri clips, to catch truncated downloads.
function remoteSizes() {
  if (!fs.existsSync(REPORT_PATH)) return new Map();
  const report = require(REPORT_PATH);
  return new Map(
    report.results
      .filter((r) => r.ok && r.bytes)
      .map((r) => [r.url.replace('https://koshur.org/', ''), r.bytes])
  );
}

function stage() {
  if (!fs.existsSync(AUDIO_DIR)) {
    throw new Error('data/audio/ not found — staging needs the scraped files locally');
  }
  const referenced = referencedKeys();
  const sizes = remoteSizes();
  const manifest = [];
  const unmapped = [];
  const unreferenced = [];
  const sizeMismatch = [];

  fs.rmSync(STAGE_DIR, { recursive: true, force: true });

  for (const file of walk(AUDIO_DIR).filter((f) => f.endsWith('.mp3'))) {
    const rel = path.relative(AUDIO_DIR, file);
    const key = keyForLocalFile(rel);
    if (!key) {
      unmapped.push(rel);
      continue;
    }
    if (!referenced.has(key)) {
      unreferenced.push(key);
      continue;
    }
    const expected = sizes.get(key);
    if (expected && expected !== fs.statSync(file).size) {
      sizeMismatch.push(key);
      continue;
    }
    const dest = path.join(STAGE_DIR, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
    manifest.push(key);
  }

  manifest.sort();
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const missing = [...referenced].filter((k) => !manifest.includes(k));
  console.log(`referenced by app:   ${referenced.size}`);
  console.log(`staged + manifested: ${manifest.length}`);
  console.log(`still on koshur.org: ${missing.length}`);
  console.log(`skipped — unmapped layout: ${unmapped.length}, unreferenced: ${unreferenced.length}, size mismatch: ${sizeMismatch.length}`);
  if (sizeMismatch.length) console.log('  size mismatch:', sizeMismatch.join(', '));
  console.log(`\nWrote ${path.relative(ROOT, MANIFEST_PATH)}. Upload with:\n`);
  for (const top of fs.readdirSync(STAGE_DIR)) {
    console.log(
      `supabase storage cp -r "${path.join(STAGE_DIR, top)}" ss:///${BUCKET}/${top} --experimental -j 8 --content-type audio/mpeg --cache-control max-age=31536000`
    );
  }
}

function supabaseUrl() {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL) return process.env.EXPO_PUBLIC_SUPABASE_URL;
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const m = env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m);
  if (!m) throw new Error('EXPO_PUBLIC_SUPABASE_URL not set');
  return m[1].trim();
}

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

// Storage rate-limits bursts of requests with 429, which says nothing about
// whether the object exists, so back off and retry those instead of failing.
async function headWithRetry(url) {
  let status = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    status = await head(url);
    if (status !== 429 && status !== 0) return status;
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
  return status;
}

async function verify() {
  const base = `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/`;
  const manifest = require(MANIFEST_PATH);
  const failures = [];
  const queue = manifest.slice();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const key = queue.shift();
        const status = await headWithRetry(base + key);
        if (status !== 200) failures.push(`${status} ${key}`);
      }
    })
  );
  console.log(`checked ${manifest.length}, failed ${failures.length}`);
  failures.slice(0, 20).forEach((f) => console.log(`  ${f}`));
  process.exitCode = failures.length ? 1 : 0;
}

if (process.argv.includes('--verify')) {
  verify();
} else {
  stage();
}
