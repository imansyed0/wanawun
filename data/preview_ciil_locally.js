#!/usr/bin/env node
/*
 * Generates a local preview site for the CIIL (Audio Cassette Course) lesson
 * HTML content so you can eyeball it in a browser before rebuilding the app.
 * Each page is wrapped with the same CSS/viewport settings the in-app WebView
 * applies, so the rendered result is representative of what shows on the
 * lesson screen.
 *
 * Output:
 *   data/preview/ciil/index.html        table of contents
 *   data/preview/ciil/progN.html        one file per programme
 *
 * After running:
 *   open data/preview/ciil/index.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTEXT_PATH = path.join(ROOT, 'data', 'ciil_structured_context.json');
const OUT_DIR = path.join(ROOT, 'data', 'preview', 'ciil');

const PAGE_CSS = `
  :root { color-scheme: light; }
  body {
    margin: 0;
    padding: 0 0 24px;
    background: #ffffff;
    color: #2f2a25;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.5;
  }
  .chrome {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 20px;
  }
  .chrome .meta {
    font-size: 13px;
    color: #7a7266;
    margin-bottom: 8px;
  }
  .chrome h1 {
    margin: 0 0 16px;
    font-size: 22px;
  }
  .chrome .nav a {
    text-decoration: none;
    color: #2f6f53;
    font-weight: 600;
  }
  .chrome .audio {
    background: #f6f1e7;
    padding: 10px 12px;
    border-radius: 10px;
    margin-bottom: 18px;
  }
  .content {
    padding: 0 20px;
  }
  .content p {
    margin: 0 0 14px;
    font-size: 16px;
  }
  .content div { margin: 0 0 18px; }
  .content img {
    display: block;
    width: 100%;
    height: auto;
    background: #f6f1e7;
    border-radius: 12px;
    margin: 0 0 10px;
  }
  .content a { color: #2f6f53; }
  .content table { border-collapse: collapse; }
  .content table td { padding: 2px 6px; }
`;

function wrapPage(lesson, prev, next) {
  const title = lesson.heading || lesson.lessonId;
  const programmeN = lesson.lessonId.replace('ciil-prog', '');
  const audioUrl = `https://koshur.org/ciil/audio/prog${programmeN}.mp3`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <div class="chrome">
    <div class="meta">
      <a href="index.html">&larr; back to index</a>
      &middot;
      source:
      <a href="${lesson.pageUrl}" target="_blank" rel="noopener">${lesson.pageUrl}</a>
    </div>
    <h1>${title}</h1>
    <div class="audio">
      <audio controls src="${audioUrl}" style="width: 100%"></audio>
    </div>
    <div class="nav">
      ${prev ? `<a href="${prev}">&larr; prev</a>` : ''}
      ${prev && next ? ' &middot; ' : ''}
      ${next ? `<a href="${next}">next &rarr;</a>` : ''}
    </div>
  </div>
  <div class="content">
    ${lesson.htmlContent || '<p><em>No htmlContent captured for this lesson.</em></p>'}
  </div>
</body>
</html>`;
}

function buildIndex(lessons) {
  const rows = lessons
    .sort(
      (a, b) =>
        Number(a.lessonId.replace('ciil-prog', '')) -
        Number(b.lessonId.replace('ciil-prog', ''))
    )
    .map((lesson) => {
      const n = lesson.lessonId.replace('ciil-prog', '');
      const kb = ((lesson.htmlContent || '').length / 1024).toFixed(1);
      const flag = !lesson.htmlContent || lesson.htmlContent.length < 200
        ? ' <span style="color:#b03030">(short / empty)</span>'
        : '';
      return `<li><a href="prog${n}.html">Programme ${n}: ${
        lesson.heading || ''
      }</a> &middot; ${kb} KB${flag}</li>`;
    })
    .join('\n      ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CIIL Lesson Preview</title>
  <style>${PAGE_CSS}
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="chrome">
    <h1>CIIL Audio Cassette Course — Local Preview</h1>
    <p>
      Each page below renders the lesson's <code>htmlContent</code> from
      <code>data/ciil_structured_context.json</code> wrapped in the same CSS
      the in-app WebView uses. Click through to verify formatting before
      rebuilding the iOS app.
    </p>
    <ul>
      ${rows}
    </ul>
  </div>
</body>
</html>`;
}

function main() {
  const lessons = JSON.parse(fs.readFileSync(CONTEXT_PATH, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sorted = [...lessons].sort(
    (a, b) =>
      Number(a.lessonId.replace('ciil-prog', '')) -
      Number(b.lessonId.replace('ciil-prog', ''))
  );

  sorted.forEach((lesson, i) => {
    const n = lesson.lessonId.replace('ciil-prog', '');
    const prev = i > 0 ? `prog${sorted[i - 1].lessonId.replace('ciil-prog', '')}.html` : null;
    const next =
      i < sorted.length - 1
        ? `prog${sorted[i + 1].lessonId.replace('ciil-prog', '')}.html`
        : null;
    const html = wrapPage(lesson, prev, next);
    fs.writeFileSync(path.join(OUT_DIR, `prog${n}.html`), html, 'utf8');
  });

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), buildIndex(sorted), 'utf8');
  console.log(
    `Wrote ${sorted.length} programme pages + index to ${path.relative(ROOT, OUT_DIR)}`
  );
  console.log(`Open with: open ${path.relative(ROOT, path.join(OUT_DIR, 'index.html'))}`);
}

main();
