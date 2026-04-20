#!/usr/bin/env node
/*
 * Scrapes every CIIL programme page and stores the raw lesson body HTML in
 * data/ciil_structured_context.json under the `htmlContent` field, keeping
 * the existing structured fields intact (intro, sections, highlights) as
 * a best-effort fallback.
 *
 * The app renders htmlContent in a WebView for lessons where it exists,
 * which preserves the original page layout (paragraphs, word tables with
 * non-breaking spaces, etc.) without relying on fragile HTML→JSON parsing.
 *
 * Usage:
 *   node data/crawl_ciil_html.js            # all 41 programmes
 *   node data/crawl_ciil_html.js 9 10 11    # only specified programmes
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'ciil_structured_context.json');
const BASE = 'https://koshur.org/ciil/';
const TOTAL = 41;

const HEADERS = {
  Referer: BASE,
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/**
 * Extract the main body HTML of a CIIL programme page.
 *
 * Every prog{N}.html uses the structure:
 *   <TD class=bodytext ... bgcolor="#FFFFFF">
 *     <center><img SRC="images/title3.gif" ...>
 *       <table ...><tr><td>
 *         <p align="center"><b><font ...>Programme N</font></b></p>
 *       </td></tr></table>
 *       <p><a href="audio/progN.mp3">...Click here for audio</a></font></b></center>
 *     ...actual lesson body...
 *     <center>
 *       <table cols="2" width="75%" bgColor="#FF0000" ...>    ← prev/next nav
 *         ...
 *       </table>
 *     </center>
 *   </TD>
 *
 * We grab everything after the "Click here for audio" closing </center>
 * and before the nav table's wrapping <center>.
 */
function extractBodyHtml(html, programmeNumber) {
  // The closing tags after "Click here for audio" vary slightly across
  // programmes (some include </center>, some don't), so match up through
  // the nearest combination of </a></font></b> and optional </center>.
  const startMarker = /Click here for audio\s*<\/a>\s*<\/font>\s*<\/b>\s*(?:<\/center>)?/i;
  const startMatch = html.match(startMarker);
  if (!startMatch || startMatch.index == null) {
    throw new Error(`prog${programmeNumber}: audio link marker not found`);
  }
  const start = startMatch.index + startMatch[0].length;

  // Nav table uses the signature bgColor="#FF0000" across every page.
  const endMarker = /<table[^>]*bgColor="#FF0000"/i;
  const tail = html.slice(start);
  const endMatch = tail.match(endMarker);
  if (!endMatch || endMatch.index == null) {
    throw new Error(`prog${programmeNumber}: nav-table marker not found`);
  }

  // Walk back from the nav table to the <center> that wraps it, if any.
  let end = endMatch.index;
  const before = tail.slice(0, end);
  const lastCenter = before.toLowerCase().lastIndexOf('<center>');
  if (lastCenter !== -1 && /^\s*$/.test(before.slice(lastCenter + 8))) {
    end = lastCenter;
  }

  let body = tail.slice(0, end);

  // Rewrite relative asset URLs to absolute ones so the WebView loads them.
  body = body
    .replace(/(src|SRC|href|HREF)=(["'])images\//g, `$1=$2${BASE}images/`)
    .replace(/(src|SRC|href|HREF)=(["'])audio\//g, `$1=$2${BASE}audio/`);

  // Remove truly empty trailing `<br>` / `&nbsp;` / `<font>` noise.
  body = body
    .replace(/(\s|&nbsp;|<br\s*\/?>)+$/i, '')
    .replace(/<\/font>\s*<\/TD>\s*$/i, '</font>')
    .trim();

  return body;
}

function loadExistingJson() {
  if (!fs.existsSync(OUT_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  } catch (err) {
    console.warn('Could not parse existing JSON, starting fresh:', err.message);
    return [];
  }
}

async function main() {
  const targets = process.argv
    .slice(2)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= TOTAL);
  const programmes = targets.length ? targets : Array.from({ length: TOTAL }, (_, i) => i + 1);

  const existing = loadExistingJson();
  const byId = new Map(existing.map((entry) => [entry.lessonId, entry]));

  for (const n of programmes) {
    const lessonId = `ciil-prog${n}`;
    const url = `${BASE}prog${n}.html`;
    try {
      const html = await fetchPage(url);
      const body = extractBodyHtml(html, n);

      const current = byId.get(lessonId) ?? {
        courseId: 'ciil',
        lessonId,
        pageUrl: url,
        heading: `Programme ${n}`,
        intro: '',
        sections: [],
        highlights: [],
      };
      current.htmlContent = body;
      current.pageUrl = url;
      byId.set(lessonId, current);

      const sizeKb = (body.length / 1024).toFixed(1);
      console.log(`prog${n}: ${sizeKb} KB of htmlContent captured`);
    } catch (err) {
      console.error(`prog${n}: ${err.message}`);
    }
  }

  const output = Array.from(byId.values()).sort((a, b) => {
    const an = Number(a.lessonId.replace('ciil-prog', ''));
    const bn = Number(b.lessonId.replace('ciil-prog', ''));
    return an - bn;
  });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${output.length} entries to ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
