// Scrapes the Omkar N. Koul "Spoken Kashmiri: A Language Course" site
// (https://koshur.org/Kashmiri/chapterN/) and writes per-chapter image+audio
// pairs grouped by sub-page (lesson / drills / exercises / notes / vocabulary).
//
// Run with:  node data/crawl_koul.js

const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://koshur.org/Kashmiri/chapter';
const CHAPTER_COUNT = 20;
const OUTPUT_PATH = '/Users/imans/wanawun/data/koul_content.json';

const HEADERS = {
  Referer: 'https://koshur.org/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SUBPAGES = [
  { key: 'lesson', file: 'index.html', label: 'Lesson' },
  { key: 'drills', file: 'd.html', label: 'Drills' },
  { key: 'exercises', file: 'e.html', label: 'Exercises' },
  { key: 'notes', file: 'n.html', label: 'Notes' },
  { key: 'vocabulary', file: 'v.html', label: 'Vocabulary' },
];

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: HEADERS }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Strip the shared nav/header area so we only scan the real chapter body for
// audio/image pairs. The body is inside the <TD class=bodytext> cell.
function extractBody(html) {
  const match = html.match(
    /<TD class=bodytext[\s\S]*?(?=<!--webbot bot="Include" U-Include="\.\.\/\.\.\/home\/footnote\.html"|<\/body>)/i
  );
  return match ? match[0] : html;
}

function extractPairs(html) {
  // Matches: <a href="[audio/]X.mp3"> ... <img SRC="images/Y.jpg" ...> ... </a>
  // Chapters 1–4 use `audio/X.mp3`; chapters 5–20 serve audio directly at the
  // chapter root (`X.mp3`). Both image and audio refs use mixed case attrs.
  const re =
    /<a\s+href="(?:audio\/)?([^"\/]+\.mp3)"[^>]*>\s*<img[^>]+src="images\/([^"]+\.jpg)"/gi;
  const seen = new Set();
  const pairs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const audio = m[1];
    const image = m[2];
    const key = `${audio}::${image}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ image, audio });
  }
  return pairs;
}

// Detect where audio lives for a chapter. Chapters 1–4 use `audio/X.mp3`;
// chapters 5–20 serve audio from the chapter root. We probe the index page
// HTML once to decide the base URL suffix we'll encode into the JSON.
function detectAudioPrefix(html) {
  if (/<a\s+href="audio\/[^"]+\.mp3"/i.test(html)) return 'audio/';
  return '';
}

async function fetchSubpageHtml(chapter, sub) {
  const url = `${BASE_URL}${chapter}/${sub.file}`;
  try {
    return await fetchPage(url);
  } catch (error) {
    console.error(`Chapter ${chapter} ${sub.file}: ${error.message}`);
    return '';
  }
}

async function crawlChapter(chapter) {
  const subpageHtml = {};
  for (const sub of SUBPAGES) {
    subpageHtml[sub.key] = await fetchSubpageHtml(chapter, sub);
    await sleep(150);
  }

  const audioPrefix = detectAudioPrefix(subpageHtml.lesson || '');

  const sections = {};
  for (const sub of SUBPAGES) {
    const html = subpageHtml[sub.key] || '';
    sections[sub.key] = extractPairs(extractBody(html));
  }

  const result = {
    chapter,
    title: `Lesson ${chapter}`,
    audioPrefix,
    sections,
  };

  const total = Object.values(sections).reduce((sum, arr) => sum + arr.length, 0);
  console.log(
    `Chapter ${chapter} [audio=${audioPrefix || '(root)'}]: lesson=${sections.lesson.length} drills=${sections.drills.length} exercises=${sections.exercises.length} notes=${sections.notes.length} vocab=${sections.vocabulary.length} total=${total}`
  );
  return result;
}

async function main() {
  const chapters = [];
  for (let n = 1; n <= CHAPTER_COUNT; n += 1) {
    try {
      const chapter = await crawlChapter(n);
      chapters.push(chapter);
    } catch (error) {
      console.error(`Chapter ${n} failed: ${error.message}`);
    }
    if (n < CHAPTER_COUNT) await sleep(250);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(chapters, null, 2), 'utf8');
  console.log(`Saved ${chapters.length} chapters to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
