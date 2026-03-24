const fs = require('fs');

const OUTPUT_PATH = '/Users/imans/wanawun/data/course_context.json';

const HEADERS = {
  Referer: 'https://koshur.org/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

const learnLessons = [
  { lessonId: 'learn-ch1', pageNumber: 2 },
  { lessonId: 'learn-ch2', pageNumber: 3 },
  { lessonId: 'learn-ch3', pageNumber: 4 },
  { lessonId: 'learn-ch4', pageNumber: 5 },
  { lessonId: 'learn-ch5', pageNumber: 6 },
  { lessonId: 'learn-ch6', pageNumber: 7 },
  { lessonId: 'learn-ch7', pageNumber: 8 },
  { lessonId: 'learn-ch8', pageNumber: 9 },
  { lessonId: 'learn-ch9', pageNumber: 10 },
  { lessonId: 'learn-ch10', pageNumber: 11 },
  { lessonId: 'learn-ch11', pageNumber: 12 },
  { lessonId: 'learn-ch12', pageNumber: 13 },
];

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

function normalizeWhitespace(str) {
  return decodeEntities(str)
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(str) {
  return normalizeWhitespace(
    str
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, ' | ')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
  );
}

async function fetchPage(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function extractMainContent(html) {
  const match = html.match(
    /<TD class=bodytext[^>]*bgcolor="#FFFFFF">([\s\S]*?)<\/TD><\/TR><\/TBODY><\/TABLE><\/TD>/i
  );
  return match ? match[1] : '';
}

function filterLines(lines, ignorePatterns) {
  return lines.filter((line) => {
    if (!line) return false;
    if (line.length < 2) return false;
    if (ignorePatterns.some((pattern) => pattern.test(line))) return false;
    return true;
  });
}

function unique(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function joinWrappedLines(lines) {
  const blocks = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const previous = blocks[blocks.length - 1];
    if (
      previous &&
      !/[.!?:]$/.test(previous) &&
      !/^[A-Z][A-Za-z]+ \d+$/i.test(trimmed) &&
      (trimmed.length < 40 || /^[a-z(]/.test(trimmed))
    ) {
      blocks[blocks.length - 1] = `${previous} ${trimmed}`.replace(/\s+/g, ' ').trim();
      continue;
    }

    blocks.push(trimmed);
  }

  return blocks;
}

function parseLearnPage(html, pageUrl) {
  const mainContent = extractMainContent(html);
  const titleMatch = mainContent.match(
    /<b><font size="\+2" color="#CC0000">([^<]+)<\/font><\/b>/i
  );
  const chapterMatch = mainContent.match(
    /<b><font size="\+1" color="#000066">([^<]+)<\/font><\/b>/i
  );
  const note = /NOTE:\s*Click on any/i.test(stripTags(mainContent))
    ? 'Click any image on the original page to play its matching audio clip.'
    : '';

  const comicSansBlocks = unique(
    Array.from(
      mainContent.matchAll(
        /<b><font[^>]*face="Comic Sans MS"[^>]*>([\s\S]*?)<\/font><\/b>/gi
      )
    )
      .map((match) => stripTags(match[1]))
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );

  const englishPromptMatches = Array.from(
    mainContent.matchAll(/<td[^>]*width="45%".*?>([\s\S]*?)<\/td>/gi)
  ).map((match) => stripTags(match[1]));

  const text = stripTags(mainContent)
    .replace(/\|\s*\|/g, '|')
    .replace(/\s+\|\s+/g, ' | ');

  const lines = joinWrappedLines(
    unique(
      filterLines(
        text.split('\n').map((line) => line.trim()),
        [
          /^omkar n\.? wakhlu/i,
          /^wakhlu\s*&\s*bharat wakhlu$/i,
          /^click here for audio/i,
          /^previous chapter/i,
          /^next chapter/i,
          /^index$/i,
          /^koshur site index$/i,
          /^\(\d+ of \d+\)$/i,
          /^chapter \d+$/i,
          /^note:\s*click on any jpg image below to listen to the audio clip\.?$/i,
          /^audio clip\.?$/i,
          /^previous$/i,
          /^site index \|?$/i,
          /^chapter \| index \| next chapter/i,
        ]
      )
    )
  );

  const promptHighlights = unique(
    englishPromptMatches
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => /[A-Za-z]/.test(line))
      .slice(0, 5)
  );

  const intro =
    comicSansBlocks.find((line) => line.length > 60 && !/\?$/.test(line)) ||
    lines.find(
      (line) =>
        line.length > 80 &&
        !/^chapter \d+/i.test(line) &&
        !/^words$/i.test(line)
    ) ||
    '';

  const highlights = unique([
    ...comicSansBlocks.filter((line) => line !== intro),
    ...promptHighlights,
    ...lines
      .filter((line) => line !== intro)
      .filter((line) => !/^\d+$/.test(line))
      .filter((line) => line !== titleMatch?.[1]?.trim())
      .filter((line) => line !== chapterMatch?.[1]?.trim()),
  ]).slice(0, 8);

  return {
    pageUrl,
    heading: chapterMatch ? chapterMatch[1].trim() : '',
    title: titleMatch ? titleMatch[1].trim() : '',
    note,
    intro,
    highlights: unique([...highlights, ...promptHighlights]).slice(0, 8),
  };
}

function parseCiilPage(html, pageUrl) {
  const mainContent = extractMainContent(html);
  const programmeMatch = stripTags(mainContent).match(/Programme\s+\d+/i);
  const text = stripTags(mainContent)
    .replace(/\|\s*\|/g, '|')
    .replace(/\s+\|\s+/g, ' | ');

  const paragraphBlocks = unique(
    Array.from(
      mainContent.matchAll(/<p[^>]*>([\s\S]*?)(?=<p[^>]*>|<table[^>]*>|<\/TD>)/gi)
    )
      .map((match) => stripTags(match[1]))
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );

  const tableRows = unique(
    Array.from(mainContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
      .map((match) => stripTags(match[1]))
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.includes('|') || line.length > 30)
  );

  const lines = joinWrappedLines(unique(
    filterLines(
      [...paragraphBlocks, ...tableRows, ...text.split('\n').map((line) => line.trim())],
      [
        /^click here for audio$/i,
        /^previous$/i,
        /^next$/i,
        /^index$/i,
        /^koshur site index$/i,
        /^programme \d+$/i,
        /^programme \d+ \| click here for audio$/i,
        /^dear learner$/i,
        /^click here for audio \|?$/i,
      ]
    )
  ));

  const intro =
    lines.find((line) => /in this programme/i.test(line)) ||
    lines.find((line) => line.length > 60) ||
    '';

  const highlights = lines
    .filter((line) => line !== intro)
    .slice(0, 8);

  return {
    pageUrl,
    heading: programmeMatch ? programmeMatch[0] : '',
    title: '',
    note: '',
    intro,
    highlights,
  };
}

async function crawlLearnKashmiri() {
  const results = [];
  for (const lesson of learnLessons) {
    const pageUrl = `https://koshur.org/LearnKashmiri/chapter${lesson.pageNumber}/`;
    const html = await fetchPage(pageUrl);
    results.push({
      courseId: 'learn-kashmiri',
      lessonId: lesson.lessonId,
      ...parseLearnPage(html, pageUrl),
    });
  }
  return results;
}

async function crawlCiil() {
  const results = [];
  for (let programme = 1; programme <= 41; programme += 1) {
    const pageUrl = `https://koshur.org/ciil/prog${programme}.html`;
    const html = await fetchPage(pageUrl);
    results.push({
      courseId: 'ciil',
      lessonId: `ciil-prog${programme}`,
      ...parseCiilPage(html, pageUrl),
    });
  }
  return results;
}

async function main() {
  const [learn, ciil] = await Promise.all([crawlLearnKashmiri(), crawlCiil()]);
  const output = [...learn, ...ciil];
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved ${output.length} lesson contexts to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
