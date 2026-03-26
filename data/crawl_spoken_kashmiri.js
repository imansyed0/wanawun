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

function buildChapterUrl(chapterNum, page = 'index.html') {
  return `${BASE_URL}${chapterNum}/${page}`;
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

function normalizeMultilineText(str) {
  return stripHtmlTags(str)
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
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

function extractBodyContentSection(html) {
  const bodyMatch = html.match(
    /<TD class=bodytext[\s\S]*?(?=<!--webbot bot="Include" U-Include="\.\.\/\.\.\/home\/footnote\.html"|<\/body>)/i
  );

  return bodyMatch ? bodyMatch[0] : html;
}

function extractLocalSubpageLinks(html) {
  return Array.from(html.matchAll(/href="([^"]+\.html)"/gi))
    .map((match) => match[1])
    .filter(
      (href) =>
        href &&
        !href.startsWith('../') &&
        !href.startsWith('../../') &&
        !href.startsWith('http://') &&
        !href.startsWith('https://') &&
        href !== 'index.html' &&
        href !== 'vocabulary.html' &&
        href !== 'notes.html'
    )
    .filter((href, index, all) => all.indexOf(href) === index);
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

function extractNarrativeExchanges(section) {
  const rows = Array.from(section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map(
    (match) => match[1]
  );

  return rows
    .map((row) => {
      const mainMedia = row.match(
        /<a\s+href="audio\/(?!title1|caption)([^"]+\.mp3)"[^>]*>[\s\S]*?<img[^>]+src="images\/((?!chapter|title1|pic|caption)[^"]+\.jpg)"[^>]*>[\s\S]*?<\/a>/i
      );
      if (!mainMedia) return null;

      const [, audio, image] = mainMedia;
      const withoutMainMedia = row.replace(mainMedia[0], ' ');
      const withoutInlineGlosses = withoutMainMedia.replace(
        /<a\s+href="audio\/[^"]+\.mp3"[^>]*>[\s\S]*?<img[^>]+src="images\/[^"]+\.jpg"[^>]*>[\s\S]*?<\/a>/gi,
        ' '
      );
      const english = normalizeMultilineText(withoutInlineGlosses);

      if (!english) return null;

      return {
        image,
        audio,
        speaker: null,
        english,
      };
    })
    .filter(Boolean);
}

function parseChapter(html, chapterNum) {
  const conversationSection = extractMainConversationSection(html);
  const bodyContentSection = extractBodyContentSection(html);
  const conversationExchanges = extractExchanges(conversationSection);
  const narrativeExchanges =
    conversationExchanges.length === 0
      ? extractNarrativeExchanges(bodyContentSection)
      : [];

  return {
    chapter: chapterNum,
    title: extractTitle(html),
    intro: extractIntro(html, conversationSection),
    exchanges:
      conversationExchanges.length > 0 ? conversationExchanges : narrativeExchanges,
  };
}

function mergeExchanges(...groups) {
  const seen = new Set();

  return groups
    .flat()
    .filter((entry) => {
      const key = `${entry.audio}::${entry.image}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractAllChapterExchanges(html) {
  const conversationSection = extractMainConversationSection(html);
  const conversationExchanges = extractExchanges(conversationSection);
  if (conversationExchanges.length > 0) return conversationExchanges;

  const bodyContentSection = extractBodyContentSection(html);
  return extractNarrativeExchanges(bodyContentSection);
}

async function fetchChapterPages(chapterNum) {
  const indexHtml = await fetchPage(buildChapterUrl(chapterNum));
  const subpageLinks = extractLocalSubpageLinks(indexHtml);
  const subpages = [];

  for (const href of subpageLinks) {
    try {
      const html = await fetchPage(buildChapterUrl(chapterNum, href));
      subpages.push(html);
    } catch (error) {
      console.error(`Chapter ${chapterNum} subpage ${href} failed: ${error.message}`);
    }
  }

  return { indexHtml, subpages };
}

function parseChapterPages(indexHtml, subpages, chapterNum) {
  const chapter = parseChapter(indexHtml, chapterNum);

  return {
    ...chapter,
    exchanges: mergeExchanges(
      chapter.exchanges,
      ...subpages.map((html) => extractAllChapterExchanges(html))
    ),
  };
}

async function main() {
  const results = [];
  const errors = [];

  console.log('Crawling Spoken Kashmiri chapters from koshur.org...');

  for (let chapterNum = 1; chapterNum <= 50; chapterNum += 1) {
    try {
      const { indexHtml, subpages } = await fetchChapterPages(chapterNum);
      const chapter = parseChapterPages(indexHtml, subpages, chapterNum);
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
