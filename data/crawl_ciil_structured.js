const fs = require('fs');

const OUTPUT_PATH = '/Users/imans/wanawun/data/ciil_structured_context.json';

const HEADERS = {
  Referer: 'https://koshur.org/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

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

function cleanText(str) {
  return decodeEntities(str)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/�/g, 'a')
    .replace(/>/g, 'a')
    .replace(/\.mp3/g, '')
    .replace(/badistinctive/gi, 'a distinctive')
    .replace(/\.mp3matical/gi, 'grammatical')
    .replace(/\s+/g, ' ')
    .trim();
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

function simplifyTitle(text) {
  return cleanText(text)
    .replace(/^[IVXLC]+\.\s*/i, '')
    .replace(/^[A-D]\.\s*/i, '')
    .replace(/^The vocables used are:?/i, 'Key Vocabulary')
    .replace(/^The verbs introduced are:?/i, 'Key Vocabulary')
    .replace(/^Vocabulary items:?/i, 'Key Vocabulary')
    .replace(/^The vocabulary items used are:?/i, 'Key Vocabulary')
    .replace(/^Listen To The Conversation:?/i, 'Sample Dialogue')
    .replace(/^Listen the conversation:?/i, 'Sample Dialogue')
    .replace(/^Let us now listen to the conversation\.?/i, 'Sample Dialogue')
    .replace(/^Now listen to the conversation/i, 'Sample Dialogue')
    .replace(/^Listen and repeat these sentences:?/i, 'Practice Lines')
    .replace(/^Listen and repeat$/i, 'Practice Lines')
    .replace(/^Listen and learn$/i, 'Practice Lines')
    .replace(/^Listen and remember the numerals$/i, 'Numerals')
    .replace(/^Listen and remember the list of vegetables$/i, 'Vegetables')
    .trim();
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectParagraphs(mainContent) {
  return Array.from(mainContent.matchAll(/<p[^>]*>([\s\S]*?)(?=<p[^>]*>|<table|$)/gi))
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .filter((text) => !/^Click here for audio$/i.test(text))
    .filter((text) => !/^(Previous|Index|Next|Koshur Site Index)$/i.test(text));
}

function parseTable(tableHtml, precedingTitle) {
  const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) =>
    Array.from(match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
      .map((cell) => cleanText(cell[1]))
      .map((cell) => cell.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );

  const meaningfulRows = rows.filter((row) => row.length > 0);
  if (meaningfulRows.length === 0) return null;

  const title = simplifyTitle(precedingTitle || '');

  const dialogueItems = meaningfulRows
    .filter((row) => row.length >= 3)
    .map((row) => row[row.length - 1])
    .filter((text) => /[A-Za-z]/.test(text))
    .filter((text) => !/^What vegetables, sir\?$/i.test(text) || true);

  if (/Sample Dialogue/i.test(title) && dialogueItems.length >= 2) {
    const rows = meaningfulRows
      .filter((row) => row.length >= 3)
      .map((row) => ({
        kashmiri: row[row.length - 2],
        english: row[row.length - 1],
      }))
      .filter((row) => row.kashmiri && row.english);

    return {
      title: 'Sample Dialogue',
      items: dedupe(dialogueItems),
      rows,
    };
  }

  const pairItems = [];
  for (const row of meaningfulRows) {
    const cells = row.filter((cell) => !/^[ARGN]:$/i.test(cell)).filter((cell) => !/^\d+\.$/.test(cell));
    if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
      for (let i = 0; i + 2 < cells.length; i += 3) {
        if (cells[i] && cells[i + 1] && cells[i + 2]) {
          pairItems.push(`${cells[i]} - ${cells[i + 1]} - ${cells[i + 2]}`);
        }
      }
    } else if (cells.length >= 2) {
      for (let i = 0; i + 1 < cells.length; i += 2) {
        if (cells[i] && cells[i + 1]) {
          pairItems.push(`${cells[i]} - ${cells[i + 1]}`);
        }
      }
    } else if (cells.length === 1) {
      pairItems.push(cells[0]);
    }
  }

  if (!/Practice Lines/i.test(title) && pairItems.length >= 2) {
    return {
      title: title || 'Key Vocabulary',
      items: dedupe(pairItems),
    };
  }

  const practiceItems = meaningfulRows
    .flatMap((row) => row)
    .filter((text) => /[A-Za-z]/.test(text))
    .filter((text) => !/^(Previous|Index|Next|Koshur Site Index)$/i.test(text));

  if (practiceItems.length >= 3) {
    return {
      title: title || 'Practice Lines',
      items: dedupe(practiceItems),
    };
  }

  return null;
}

function parseProgramme(html, programmeNumber) {
  const mainContent = extractMainContent(html);
  const paragraphs = collectParagraphs(mainContent);
  const intro = paragraphs.find(
    (text) =>
      text.length > 25 &&
      !/^Listen/i.test(text) &&
      !/^(I:|A:|R:|G:|N:)/.test(text)
  ) || '';

  const sections = [];
  const tableMatches = Array.from(mainContent.matchAll(/<table[\s\S]*?<\/table>/gi)).map(
    (match) => match[0]
  );

  let searchIndex = 0;
  for (const tableHtml of tableMatches) {
    const tableIndex = mainContent.indexOf(tableHtml, searchIndex);
    const beforeTable = mainContent.slice(0, tableIndex);
    const prevParagraphs = collectParagraphs(beforeTable);
    const precedingTitle = prevParagraphs[prevParagraphs.length - 1] || '';
    const section = parseTable(tableHtml, precedingTitle);
    if (section && section.items.length > 0) {
      const existing = sections.find((entry) => entry.title === section.title);
      if (existing) {
        existing.items = dedupe([...existing.items, ...section.items]);
      } else {
        sections.push(section);
      }
    }
    searchIndex = tableIndex + tableHtml.length;
  }

  const normalizedSections = sections
    .filter((section) => section.title !== 'Practice Lines' || /Listen|repeat|Practice/i.test(section.title))
    .filter((section) => section.items.length > 0);

  return {
    courseId: 'ciil',
    lessonId: `ciil-prog${programmeNumber}`,
    pageUrl: `https://koshur.org/ciil/prog${programmeNumber}.html`,
    heading: `Programme ${programmeNumber}`,
    intro,
    sections: normalizedSections,
  };
}

async function main() {
  const results = [];
  for (let programme = 1; programme <= 41; programme += 1) {
    const html = await fetchPage(`https://koshur.org/ciil/prog${programme}.html`);
    results.push(parseProgramme(html, programme));
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Saved ${results.length} programmes to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
