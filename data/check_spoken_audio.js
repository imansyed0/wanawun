#!/usr/bin/env node
/*
 * Scans every Spoken Kashmiri (Kachru) lesson and reports which audio clips
 * are reachable on koshur.org via HEAD requests. Includes both the vocabulary
 * clips (from kachru_vocabulary.json) and the conversation/reading clips
 * hardcoded in src/data/courses.ts, mirroring the URLs the app actually
 * requests in the lesson player.
 *
 * Usage:
 *   node data/check_spoken_audio.js            # check every chapter
 *   node data/check_spoken_audio.js 3 17 41    # check specific chapters
 *   CONCURRENCY=20 node data/check_spoken_audio.js
 *
 * Output:
 *   - Live progress per chapter with OK / broken counts
 *   - Final summary table
 *   - data/check_spoken_audio_report.json with full details
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COURSES_PATH = path.join(ROOT, 'src', 'data', 'courses.ts');
const VOCAB_PATH = path.join(ROOT, 'data', 'kachru_vocabulary.json');
const REPORT_PATH = path.join(ROOT, 'data', 'check_spoken_audio_report.json');

const CONCURRENCY = Number(process.env.CONCURRENCY || 12);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 10000);

function parseChapters() {
  const src = fs.readFileSync(COURSES_PATH, 'utf8');
  const marker = 'const spokenKashmiriChapters';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('Could not find spokenKashmiriChapters in courses.ts');
  const eq = src.indexOf('=', start);
  if (eq === -1) throw new Error('Could not find = after spokenKashmiriChapters');
  const arrStart = src.indexOf('[', eq);
  // Walk brackets to find the matching close.
  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < src.length; i++) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error('Unclosed spokenKashmiriChapters array');
  const literal = src.slice(arrStart, end);
  // Evaluate the array literal — it only contains plain primitives.
  return Function(`return ${literal};`)();
}

function buildVocabClipsByChapter() {
  const raw = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));
  const entries = Array.isArray(raw) ? raw : Object.values(raw);
  const map = new Map();
  for (const entry of entries) {
    const ch = entry.chapter;
    if (!ch) continue;
    const clips = [];
    for (const group of entry.groups ?? []) {
      for (const item of group.items ?? []) {
        if (item?.audio) {
          clips.push({
            kind: 'vocab',
            filename: item.audio,
            group: group.title ?? '',
          });
        }
      }
    }
    map.set(ch, clips);
  }
  return map;
}

function buildClipsForChapter(chapter, vocabMap) {
  const base = `https://koshur.org/SpokenKashmiri/Chapter${chapter.n}/audio/`;
  const vocab = vocabMap.get(chapter.n) ?? [];
  const vocabResolved = vocab.map((v) => ({
    chapter: chapter.n,
    kind: 'vocab',
    filename: v.filename,
    group: v.group,
    url: base + v.filename,
  }));
  const convo = chapter.clips.map((c) => ({
    chapter: chapter.n,
    kind: 'lesson',
    filename: `${c}.mp3`,
    url: base + `${c}.mp3`,
  }));
  return [...vocabResolved, ...convo];
}

async function headOne(clip) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Pull the first few KB so we can validate the body is a real MP3 frame
    // and not an HTML error page being served with a misleading 200 status.
    const res = await fetch(clip.url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { Range: 'bytes=0-4095' },
    });
    const statusOk = res.ok || res.status === 206;
    if (!statusOk) {
      return { ...clip, status: res.status, ok: false };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const contentRange = res.headers.get('content-range') || '';
    // total size if the server honored the range request; otherwise we only
    // saw the first chunk and treat that as the minimum.
    const totalBytes = (() => {
      const m = contentRange.match(/\/(\d+)\s*$/);
      if (m) return Number(m[1]);
      const len = res.headers.get('content-length');
      return len ? Number(len) : buf.length;
    })();

    // MP3 frame sync: 0xFF followed by 0xE0-0xFF (11 ones in upper bits).
    // Some files carry an ID3v2 header ("ID3") before the first frame.
    const looksLikeMp3 =
      buf.length >= 2 &&
      ((buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) ||
        (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33));
    const looksLikeHtml =
      /<html|<!doctype/i.test(buf.slice(0, 256).toString('utf8')) ||
      /text\/html/.test(contentType);

    const tooSmall = totalBytes < 1024;

    if (!looksLikeMp3 || looksLikeHtml || tooSmall) {
      return {
        ...clip,
        status: res.status,
        ok: false,
        bytes: totalBytes,
        contentType,
        error: looksLikeHtml
          ? 'body is HTML'
          : tooSmall
            ? `body only ${totalBytes} bytes`
            : 'not a valid MP3 header',
      };
    }

    return { ...clip, status: res.status, ok: true, bytes: totalBytes, contentType };
  } catch (err) {
    return { ...clip, status: 0, ok: false, error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  let lastPrint = 0;

  async function run() {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      results[i] = await worker(items[i]);
      done++;
      const now = Date.now();
      if (now - lastPrint > 400 || done === total) {
        lastPrint = now;
        process.stdout.write(`\r  …checked ${done}/${total}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, run));
  process.stdout.write('\n');
  return results;
}

(async () => {
  const chapters = parseChapters();
  const vocabMap = buildVocabClipsByChapter();

  const filterArgs = process.argv.slice(2).map(Number).filter(Number.isFinite);
  const selected = filterArgs.length
    ? chapters.filter((c) => filterArgs.includes(c.n))
    : chapters;

  const allClips = selected.flatMap((ch) => buildClipsForChapter(ch, vocabMap));
  console.log(
    `Checking ${allClips.length} audio URLs across ${selected.length} chapters ` +
      `(concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms)`
  );

  const results = await runPool(allClips, headOne, CONCURRENCY);

  const perChapter = new Map();
  for (const r of results) {
    if (!perChapter.has(r.chapter)) perChapter.set(r.chapter, []);
    perChapter.get(r.chapter).push(r);
  }

  console.log('\nPer-chapter summary (chapters with broken clips are marked):');
  const summaryRows = [];
  for (const ch of selected) {
    const rows = perChapter.get(ch.n) ?? [];
    const broken = rows.filter((r) => !r.ok);
    const vocab = rows.filter((r) => r.kind === 'vocab');
    const vocabBroken = vocab.filter((r) => !r.ok);
    const status = broken.length === 0 ? 'OK' : `BROKEN (${broken.length}/${rows.length})`;
    summaryRows.push({
      chapter: ch.n,
      title: ch.title,
      totalClips: rows.length,
      broken: broken.length,
      vocabClips: vocab.length,
      vocabBroken: vocabBroken.length,
      status,
    });
  }
  // Columnar print.
  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    `\n  ${pad('Ch', 4)}${pad('Status', 24)}${pad('Broken', 10)}${pad('Vocab', 10)}Title`
  );
  for (const row of summaryRows) {
    const broken = `${row.broken}/${row.totalClips}`;
    const vocab = `${row.vocabBroken}/${row.vocabClips}`;
    console.log(
      `  ${pad(row.chapter, 4)}${pad(row.status, 24)}${pad(broken, 10)}${pad(vocab, 10)}${row.title}`
    );
  }

  const brokenAll = results.filter((r) => !r.ok);
  console.log(
    `\nTotals: ${results.length - brokenAll.length} OK, ${brokenAll.length} broken of ${results.length}.`
  );

  if (brokenAll.length) {
    console.log('\nBroken URLs:');
    for (const r of brokenAll) {
      const tag = r.kind === 'vocab' ? `[vocab:${r.group || '-'}]` : '[lesson]';
      const reason = r.error ? r.error : `HTTP ${r.status}`;
      console.log(`  Ch${r.chapter} ${tag} ${r.filename}  →  ${reason}`);
    }
  }

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        concurrency: CONCURRENCY,
        totalChecked: results.length,
        totalBroken: brokenAll.length,
        perChapter: summaryRows,
        broken: brokenAll,
        results,
      },
      null,
      2
    )
  );
  console.log(`\nFull report written to ${path.relative(ROOT, REPORT_PATH)}`);

  process.exit(brokenAll.length > 0 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
