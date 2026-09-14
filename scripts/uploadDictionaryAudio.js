// Stages Sheeba Hassan dictionary pronunciations from kashmiri_dataset for the
// `course-audio` Supabase Storage bucket (see 008_course_audio_bucket.sql and
// scripts/uploadCourseAudio.js), under hassan-dictionary/<DSAL id>.mp3.
// Used by the English → Kashmiri word sheet (WAN-53).
//
//   node scripts/uploadDictionaryAudio.js --dataset <kashmiri_dataset clone>
//       verify checksums, stage files, write data/dictionary_audio_manifest.json
//   supabase storage cp -r ... (command printed by the step above)
//   node scripts/uploadDictionaryAudio.js --verify
//       HEAD every object; when all exist, sets "uploaded": true so the app
//       streams from the bucket instead of dsal.uchicago.edu. Commit the manifest.
//
// The repo tree only has 340 of the 1,876 clips; the full set is in
// compressed_data/downloaded_content.zip.part_*, which this script unzips.

const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data/dictionary_audio_manifest.json');
const BUCKET = 'course-audio';
const PREFIX = 'hassan-dictionary/';
const WORK_DIR = path.join(os.tmpdir(), 'dictionary-audio-work');
const STAGE_DIR = path.join(os.tmpdir(), 'dictionary-audio-stage');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

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
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// Directory holding every uchicago_S_Hassan/*.mp3, unzipping the split archive if needed.
function audioDir(dataset) {
  const parts = fs
    .readdirSync(path.join(dataset, 'compressed_data'))
    .filter((f) => f.startsWith('downloaded_content.zip.part_'))
    .sort();
  if (!parts.length) return path.join(dataset, 'downloaded_content/uchicago_S_Hassan');
  const outDir = path.join(WORK_DIR, 'uchicago_S_Hassan');
  if (!fs.existsSync(outDir) || fs.readdirSync(outDir).length === 0) {
    fs.mkdirSync(outDir, { recursive: true });
    const zipPath = path.join(WORK_DIR, 'downloaded_content.zip');
    fs.writeFileSync(zipPath, Buffer.concat(parts.map((p) => fs.readFileSync(path.join(dataset, 'compressed_data', p)))));
    execFileSync('unzip', ['-q', '-o', '-j', zipPath, '*/uchicago_S_Hassan/*.mp3', '-d', outDir]);
  }
  return outDir;
}

function stage(dataset) {
  const rows = parseCsv(fs.readFileSync(path.join(dataset, 'csv_files/S_Hassan_dictionary.csv'), 'utf8'));
  const dir = audioDir(dataset);
  const onDisk = new Map(fs.readdirSync(dir).map((f) => [f.normalize('NFC'), path.join(dir, f)]));
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(STAGE_DIR, PREFIX), { recursive: true });

  const ids = [];
  let missing = 0;
  let checksumMismatch = 0;
  let bytes = 0;
  for (const row of rows) {
    const id = row.file_urls.match(/(\d+)\.mp3$/)?.[1];
    const file = row.files ? row.files.match(/'path': '([^']+)'.*?'checksum': '([0-9a-f]+)'/) : null;
    if (!id || !file) continue;
    const local = onDisk.get(path.basename(file[1]).normalize('NFC'));
    if (!local) {
      missing += 1;
      continue;
    }
    const data = fs.readFileSync(local);
    // Headwords that appear twice were saved to the same filename, so only one
    // of the DSAL ids matches the bytes on disk. The others stay on DSAL.
    if (crypto.createHash('md5').update(data).digest('hex') !== file[2]) {
      checksumMismatch += 1;
      continue;
    }
    fs.writeFileSync(path.join(STAGE_DIR, PREFIX, `${id}.mp3`), data);
    ids.push(id);
    bytes += data.length;
  }

  ids.sort();
  const manifest = { bucket: BUCKET, prefix: PREFIX, uploaded: false, ids };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`);
  console.log(`dictionary rows: ${rows.length}`);
  console.log(`staged: ${ids.length} (${(bytes / 1e6).toFixed(1)} MB), missing file: ${missing}, checksum mismatch: ${checksumMismatch}`);
  console.log(`\nWrote ${path.relative(ROOT, MANIFEST_PATH)} (uploaded: false). Upload with:\n`);
  console.log(
    `supabase storage cp -r "${path.join(STAGE_DIR, PREFIX)}" ss:///${BUCKET}/${PREFIX.replace(/\/$/, '')} --experimental -j 8 --content-type audio/mpeg --cache-control max-age=31536000`
  );
  console.log('\nthen: node scripts/uploadDictionaryAudio.js --verify');
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
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const base = `${supabaseUrl()}/storage/v1/object/public/${manifest.bucket}/${manifest.prefix}`;
  const failures = [];
  const queue = manifest.ids.slice();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const id = queue.shift();
        const status = await headWithRetry(`${base}${id}.mp3`);
        if (status !== 200) failures.push(`${status} ${id}`);
      }
    })
  );
  console.log(`checked ${manifest.ids.length}, failed ${failures.length}`);
  failures.slice(0, 20).forEach((f) => console.log(`  ${f}`));
  if (failures.length) {
    process.exitCode = 1;
    return;
  }
  manifest.uploaded = true;
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`);
  console.log(`All present. Set "uploaded": true in ${path.relative(ROOT, MANIFEST_PATH)} — commit it.`);
}

if (process.argv.includes('--verify')) {
  verify();
} else {
  const dataset = arg('--dataset') ?? process.env.KASHMIRI_DATASET_DIR;
  if (!dataset || !fs.existsSync(path.join(dataset, 'csv_files'))) {
    console.error('usage: node scripts/uploadDictionaryAudio.js --dataset <kashmiri_dataset clone> | --verify');
    process.exit(1);
  }
  stage(dataset);
}
