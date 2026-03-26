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

function extractNumberedSections(lines) {
  const sections = [];
  let currentSection = null;
  let previousLine = '';

  const pushCurrentSection = () => {
    if (!currentSection || currentSection.items.length === 0) return;
    sections.push(currentSection);
    currentSection = null;
  };

  const fragments = lines.flatMap((line) =>
    line
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
  );

  for (const fragment of fragments) {
    const trimmed = fragment.trim();
    const numberedMatch = trimmed.match(/^(\d+)\.\s*(.+)$/);

    if (!numberedMatch) {
      if (currentSection) {
        pushCurrentSection();
      }
      previousLine = trimmed;
      continue;
    }

    const number = Number(numberedMatch[1]);
    const itemText = numberedMatch[2].trim();

    const shouldStartNewSection =
      !currentSection ||
      number <= currentSection.lastNumber ||
      currentSection.lastLineWasBreak;

    if (shouldStartNewSection) {
      pushCurrentSection();
      const title =
        /repeat|following sentences/i.test(previousLine)
          ? 'Practice Sentences'
          : /english\s+kashmiri/i.test(previousLine)
            ? 'Sentence Patterns'
            : 'Examples';

      currentSection = {
        title,
        items: [],
        lastNumber: 0,
        lastLineWasBreak: false,
      };
    }

    currentSection.items.push(itemText);
    currentSection.lastNumber = number;
    currentSection.lastLineWasBreak = false;
    previousLine = trimmed;
  }

  pushCurrentSection();

  return sections.map(({ title, items }) => ({ title, items }));
}

function extractLearnImageSections(mainContent) {
  const rowHtml = Array.from(mainContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map(
    (match) => match[1]
  );
  const sections = [];
  let currentSection = null;
  let previousText = '';

  const pushCurrentSection = () => {
    if (!currentSection || currentSection.items.length === 0) return;
    sections.push(currentSection);
    currentSection = null;
  };

  for (const row of rowHtml) {
    const images = Array.from(row.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))
      .map((match) => match[1])
      .filter((src) => /^images\/\d+\.jpg$/i.test(src))
      .map((src) => src.replace(/^images\//i, ''));
    const text = stripTags(row).replace(/\s+\|\s+/g, ' | ').trim();
    const numberedMatch = text.match(/^(\d+)\.\s*(.+?)\s*(?:\|\s*\|.*)?$/);

    if (images.length === 1 && numberedMatch) {
      const itemText = numberedMatch[2].trim();
      const title =
        /repeat|following sentences/i.test(previousText)
          ? 'Practice Sentences'
          : /english\s*\|\s*kashmiri/i.test(previousText)
            ? 'Examples'
            : currentSection?.title || 'Examples';

      if (!currentSection || currentSection.title !== title) {
        pushCurrentSection();
        currentSection = { title, items: [], images: [] };
      }

      currentSection.items.push(itemText);
      currentSection.images.push(images[0]);
      previousText = text;
      continue;
    }

    if (
      currentSection &&
      images.length === 0 &&
      !numberedMatch &&
      !/^(english\s*\|\s*kashmiri|chus\s*=|chu\s*=)/i.test(text)
    ) {
      pushCurrentSection();
    }

    if (text) {
      previousText = text;
    }
  }

  pushCurrentSection();
  return sections;
}

function absolutizeAssetUrls(html, pageUrl) {
  return html.replace(
    /\b(src|href)=["']([^"']+)["']/gi,
    (full, attr, value) => {
      if (/^(?:https?:|data:|mailto:|tel:|#)/i.test(value)) {
        return `${attr}="${value}"`;
      }

      try {
        return `${attr}="${new URL(value, pageUrl).href}"`;
      } catch {
        return full;
      }
    }
  );
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isLearnJunkText(text) {
  const normalized = normalizeWhitespace(text)
    .replace(/\s*\|\s*/g, ' ')
    .trim();

  return (
    !normalized ||
    /^note:\s*click on any jpg image/i.test(normalized) ||
    /^omkar n/i.test(normalized) ||
    /^\(\d+\s+of\s+\d+\)$/i.test(normalized) ||
    /^previous\s+chapter(?:\s+index)?(?:\s+next\s+chapter)?$/i.test(normalized) ||
    /^index$/i.test(normalized) ||
    /^koshur\s+site\s+index$/i.test(normalized) ||
    /^chapter\s+\d+$/i.test(normalized) ||
    /^site index$/i.test(normalized)
  );
}

function extractLearnHtmlRaw(mainContent, pageUrl) {
  let content = mainContent;

  // Drop the title/author/note header so the lesson body starts at the actual content.
  content = content.replace(
    /^[\s\S]*?<img[^>]+src=["'][^"']*line1\.jpg["'][^>]*>\s*(?:&nbsp;)?\s*(?:<\/p>)?/i,
    ''
  );

  // Drop chapter pagination widgets used on some early pages.
  content = content.replace(
    /<center>[\s\S]*?arrownext\.gif[\s\S]*?\(\d+\s+of\s+\d+\)<\/center>/gi,
    ''
  );
  content = content.replace(/<a href="[^"]+"><img[^>]+arrownext\.gif[^>]*><\/a>/gi, '');
  content = content.replace(
    /<table[^>]*>\s*<tr>\s*<td><img[^>]+nonclick\.jpg[^>]*><\/td>\s*<td><a href="[^"]+"><img[^>]+click\.jpg[^>]*><\/a><\/td>\s*<\/tr>\s*<\/table>/gi,
    ''
  );
  content = content.replace(/<center>\(\d+\s+of\s+\d+\)<\/center>/gi, '');

  // Drop the bottom navigation and site-index tables.
  content = content.replace(
    /<center>\s*<table[^>]+bgcolor="#FF0000"[\s\S]*$/i,
    ''
  );

  content = content
    .replace(/<p>\s*&nbsp;\s*<\/p>/gi, '')
    .replace(/^\s*<center>\s*<\/p>/i, '')
    .replace(/^\s*<center>\s*<\/center>/gi, '')
    .trim();

  return absolutizeAssetUrls(content, pageUrl);
}

function extractLearnHtml(mainContent, pageUrl) {
  const rowHtml = Array.from(mainContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map(
    (match) => match[1]
  );
  const blocks = [];

  const introText = stripTags(mainContent)
    .split('\n')
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length > 50 &&
        !/^omkar n/i.test(line) &&
        !/^note:/i.test(line) &&
        !/^order of words$/i.test(line)
    );

  if (introText) {
    blocks.push(`<p>${escapeHtml(introText)}</p>`);
  }

  for (const row of rowHtml) {
    const images = Array.from(row.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))
      .map((match) => match[1])
      .filter((src) => /^images\/\d+\.jpg$/i.test(src))
      .map((src) => new URL(src, pageUrl).href);
    const text = stripTags(row).replace(/\s+\|\s+/g, ' | ').trim();
    const cleanedText = text.replace(/\s*\|\s*/g, ' ').trim();

    if (
      isLearnJunkText(cleanedText) ||
      /^english\s*\|\s*kashmiri\s*\|?$/i.test(text)
    ) {
      continue;
    }

    const numberedMatch = text.match(/^(\d+)\.\s*(.+?)\s*(?:\|\s*\|.*)?$/);

    if (images.length === 1 && numberedMatch) {
      blocks.push(
        `<div>
          <img src="${images[0]}" />
          <p>${escapeHtml(numberedMatch[2].trim())}</p>
        </div>`
      );
      continue;
    }

    if (images.length > 0 && !numberedMatch) {
      blocks.push(
        `<div>
          ${images.map((src) => `<img src="${src}" />`).join('')}
          ${cleanedText ? `<p>${escapeHtml(cleanedText)}</p>` : ''}
        </div>`
      );
      continue;
    }

    if (
      cleanedText.length > 3 &&
      !/^chapter \d+/i.test(cleanedText) &&
      !/^order of words$/i.test(cleanedText)
    ) {
      blocks.push(`<p>${escapeHtml(cleanedText)}</p>`);
    }
  }

  const structuredHtml = blocks.join('\n').trim();
  const structuredImageCount = (structuredHtml.match(/<img\b/gi) || []).length;
  const sourceImageCount = (
    mainContent.match(/<img[^>]+src=["']images\/\d+\.jpg["']/gi) || []
  ).length;

  if (
    /arrownext\.gif|nonclick\.jpg|click\.jpg/i.test(structuredHtml) ||
    structuredImageCount === 0 ||
    (sourceImageCount > 0 && structuredImageCount < Math.ceil(sourceImageCount / 2))
  ) {
    return extractLearnHtmlRaw(mainContent, pageUrl);
  }

  if (/<img\b/i.test(structuredHtml)) {
    return structuredHtml;
  }

  return extractLearnHtmlRaw(mainContent, pageUrl);
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

  const sections = extractLearnImageSections(mainContent);
  const fallbackSections = sections.length > 0 ? sections : extractNumberedSections(lines);

  return {
    pageUrl,
    heading: chapterMatch ? chapterMatch[1].trim() : '',
    title: titleMatch ? titleMatch[1].trim() : '',
    note,
    intro,
    htmlContent: extractLearnHtml(mainContent, pageUrl),
    sections: fallbackSections,
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
