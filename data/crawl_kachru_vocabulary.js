// Scrapes the vocabulary.html page for each Kachru "Introduction to Spoken
// Kashmiri" chapter (https://koshur.org/SpokenKashmiri/ChapterN/vocabulary.html)
// and writes per-chapter groups of image+audio pairs.
//
// Run with:  node data/crawl_kachru_vocabulary.js

const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://koshur.org/SpokenKashmiri/Chapter';
const CHAPTER_COUNT = 50;
const OUTPUT_PATH = '/Users/imans/wanawun/data/kachru_vocabulary.json';

const HEADERS = {
  Referer: 'https://koshur.org/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Whitelist of vocab heading labels the site uses across chapters. These are
// the only <b><font>...</font></b> texts we treat as real section headings;
// everything else (nested-table column headers like "Infinitive", navigation,
// etc.) is ignored so mis-attributed groupings don't pollute the output.
const VOCAB_HEADINGS = new Set(
  [
    'Nouns',
    'Verbs',
    'Adjectives',
    'Adverbs',
    'Pronouns',
    'Numbers',
    'Postpositions',
    'Conjunctions',
    'Interjections',
    'Particles',
    'Conjunct Verbs',
    'Compound Verbs',
    'Phrases',
    'Expressions',
    'Vocabulary',
  ].map((h) => h.toLowerCase())
);

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: HEADERS }, (res) => {
        if (res.statusCode === 404) {
          resolve('');
          res.resume();
          return;
        }
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

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Restrict to the `<TD class=bodytext>` cell so nav/sidebar content is
// excluded. We use a loose terminator so chapters that omit the footer include
// still work.
function extractBody(html) {
  const match = html.match(
    /<TD class=bodytext[\s\S]*?(?=<!--webbot bot="Include" U-Include="\.\.\/\.\.\/home\/footnote\.html"|<\/body>)/i
  );
  return match ? match[0] : html;
}

// Scan the body in a single pass by absolute character position so nested
// <table> structures don't cause us to lose items (chapter 1 for example nests
// a 2-column table inside the same <tr> that holds the audio image).
function extractGroups(body) {
  // 1) Locate media pairs. The href can be "audio/vN.mp3" (most chapters) or
  //    a root-relative path like "../../SpokenKashmiri/Chapter7/audio/vN.mp3".
  //    We grab only the filename by matching non-greedy up to the last "/".
  //    SRC is case-insensitive and sometimes preceded by other attrs.
  const mediaRe =
    /<a\s+href="[^"]*?\/?([^"\/]+\.mp3)"[^>]*>\s*(?:<font[^>]*>\s*)?<img[^>]+src="[^"]*?\/?([^"\/]+\.jpg)"/gi;
  const media = [];
  let m;
  while ((m = mediaRe.exec(body)) !== null) {
    const audio = m[1];
    const image = m[2];
    // Skip chapter title audio (title1.mp3 etc.) — that's the lesson banner,
    // not vocabulary.
    if (/^title\d*\.mp3$/i.test(audio)) continue;
    // Skip chapter-preview thumbnails if any.
    if (/^chapter\d+\.jpg$/i.test(image)) continue;
    media.push({ pos: m.index, audio, image });
  }

  // 2) Locate candidate headings: bold + font wrapping a short text label.
  //    We whitelist to avoid false positives from table-column labels.
  const headingRe =
    /<b>\s*(?:<[^>]+>\s*)*<font[^>]*>\s*([^<]+?)\s*<\/font>/gi;
  const headings = [];
  while ((m = headingRe.exec(body)) !== null) {
    // Collapse any inner whitespace (the site often breaks labels like
    // "Conjunct\n        Verbs" across lines).
    const text = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (VOCAB_HEADINGS.has(text.toLowerCase())) {
      headings.push({ pos: m.index, title: text });
    }
  }

  // 3) Assign each media item to the most recent preceding heading; fall back
  //    to "Vocabulary" if none precede it.
  const groups = [];
  const dedupKey = new Set();
  for (const item of media) {
    let title = 'Vocabulary';
    for (const h of headings) {
      if (h.pos < item.pos) title = h.title;
      else break;
    }
    const key = `${title}|${item.audio}|${item.image}`;
    if (dedupKey.has(key)) continue;
    dedupKey.add(key);
    let group = groups.find((g) => g.title === title);
    if (!group) {
      group = { title, items: [] };
      groups.push(group);
    }
    group.items.push({ image: item.image, audio: item.audio });
  }

  return groups;
}

async function crawlChapter(chapter) {
  const url = `${BASE_URL}${chapter}/vocabulary.html`;
  let html = '';
  try {
    html = await fetchPage(url);
  } catch (error) {
    console.error(`Chapter ${chapter} vocabulary: ${error.message}`);
    return { chapter, groups: [] };
  }
  if (!html) return { chapter, groups: [] };

  const groups = extractGroups(extractBody(html));
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const summary = groups.map((g) => `${g.title}=${g.items.length}`).join(' ');
  console.log(`Chapter ${chapter}: ${summary || '(none)'} total=${total}`);
  return { chapter, groups };
}

async function main() {
  const chapters = [];
  for (let n = 1; n <= CHAPTER_COUNT; n += 1) {
    chapters.push(await crawlChapter(n));
    if (n < CHAPTER_COUNT) await sleep(200);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(chapters, null, 2), 'utf8');
  console.log(`Saved ${chapters.length} chapters to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
