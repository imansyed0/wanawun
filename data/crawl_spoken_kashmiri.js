const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://koshur.org/SpokenKashmiri/Chapter';
const OUTPUT_PATH = '/Users/imans/wanawun/data/spoken_kashmiri_content.json';

const HEADERS = {
  Referer: 'https://koshur.org/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

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

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8211;/gi, '-')
    .replace(/&#8212;/gi, '-')
    .replace(/&#8230;/gi, '...')
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function stripHtmlTags(str) {
  return decodeEntities(
    str
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeText(str) {
  return stripHtmlTags(str)
    .replace(/\s+/g, ' ')
    .replace(/\s([?.!,;:])/g, '$1')
    .trim();
}

function extractTitle(html) {
  const titleMatch = html.match(
    /<a\s+href="audio\/title1\.mp3"[^>]*>[\s\S]*?ALT="[^"]*Chapter\s+\d+:\s*([^"]+)"/i
  );
  if (titleMatch) {
    return normalizeText(titleMatch[1]);
  }

  const fallback = html.match(/<font\s+color="#800000"[^>]*>([\s\S]*?)<\/font>/i);
  return fallback ? normalizeText(fallback[1]) : '';
}

function extractMainConversationSection(html) {
  const sections = Array.from(
    html.matchAll(/<td[^>]+bgcolor="#FFFFFF"[^>]*>([\s\S]*?)<\/td>/gi)
  ).map((match) => match[1]);

  let bestSection = '';
  let bestCount = 0;

  for (const section of sections) {
    const count = (section.match(/audio\/conv[0-9a-z]+\.mp3/gi) || []).length;
    if (count > bestCount) {
      bestCount = count;
      bestSection = section;
    }
  }

  return bestSection;
}

function extractIntro(html, conversationSection) {
  if (!conversationSection) return '';

  const convStart = html.indexOf(conversationSection);
  if (convStart < 0) return '';

  const contentBeforeConversation = html.slice(0, convStart);
  const tail = contentBeforeConversation.slice(Math.max(0, contentBeforeConversation.length - 5000));

  const introCandidates = Array.from(
    tail.matchAll(/<td[^>]+(?:BGCOLOR|bgcolor)="#(?:ECFFFF|FFFFFF)"[^>]*>([\s\S]*?)<\/td>/gi)
  )
    .map((match) => normalizeText(match[1]))
    .filter(
      (text) =>
        text &&
        !/^(Index|Chapter\s+\d+|Lesson|New words|Structures|Notes)$/i.test(text) &&
        text.length > 60
    );

  return introCandidates.join('\n\n').trim();
}

function extractExchanges(section) {
  const matches = Array.from(
    section.matchAll(
      /<a\s+href="audio\/(conv[^"]+\.mp3)"[^>]*>\s*<img[^>]+src="images\/([^"]+\.jpg)"[^>]*>\s*<\/a>\s*<br>\s*([\s\S]*?)(?=<br>\s*<a\s+href="audio\/conv|<\/td>|$)/gi
    )
  );

  return matches
    .map((match) => {
      const [, audio, image, rawText] = match;
      const cleaned = normalizeText(rawText);
      const speakerMatch = cleaned.match(/^([^:]+):\s*(.+)$/);

      return {
        image,
        audio,
        speaker: speakerMatch ? speakerMatch[1].trim() : null,
        english: speakerMatch ? speakerMatch[2].trim() : cleaned,
      };
    })
    .filter((entry) => entry.english.length > 0);
}

function parseChapter(html, chapterNum) {
  const conversationSection = extractMainConversationSection(html);

  return {
    chapter: chapterNum,
    title: extractTitle(html),
    intro: extractIntro(html, conversationSection),
    exchanges: extractExchanges(conversationSection),
  };
}

async function main() {
  const results = [];
  const errors = [];

  console.log('Crawling Spoken Kashmiri chapters from koshur.org...');

  for (let chapterNum = 1; chapterNum <= 50; chapterNum += 1) {
    const url = `${BASE_URL}${chapterNum}/`;
    try {
      const html = await fetchPage(url);
      const chapter = parseChapter(html, chapterNum);
      results.push(chapter);
      console.log(
        `Chapter ${chapterNum}: "${chapter.title}" | intro=${chapter.intro ? 'yes' : 'no'} | exchanges=${chapter.exchanges.length}`
      );
    } catch (error) {
      console.error(`Chapter ${chapterNum} failed: ${error.message}`);
      errors.push({ chapter: chapterNum, error: error.message });
    }

    if (chapterNum < 50) {
      await sleep(500);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Saved ${results.length} chapters to ${OUTPUT_PATH}`);

  if (errors.length > 0) {
    console.log('Errors:', JSON.stringify(errors, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
