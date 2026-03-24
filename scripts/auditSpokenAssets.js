const fs = require('fs');
const https = require('https');
const vm = require('vm');

const source = fs.readFileSync('src/data/courses.ts', 'utf8');

function extractArraySource(name) {
  const marker = `const ${name}`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Missing ${name}`);
  }

  const equals = source.indexOf('=', start);
  const open = source.indexOf('[', equals);
  let depth = 0;

  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open, i + 1);
      }
    }
  }

  throw new Error(`Unclosed array for ${name}`);
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            Referer: 'https://koshur.org/',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
        (res) => {
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
        }
      )
      .on('error', reject);
  });
}

function getMatches(html, pattern) {
  return Array.from(new Set(Array.from(html.matchAll(pattern), (match) => match[1])));
}

async function main() {
  const spokenKashmiriChapters = vm.runInNewContext(
    extractArraySource('spokenKashmiriChapters')
  );

  const report = [];

  for (const chapter of spokenKashmiriChapters) {
    const url = `https://koshur.org/SpokenKashmiri/Chapter${chapter.n}/`;
    const html = await fetchPage(url);
    const actualAudio = getMatches(html, /audio\/([^"]+\.mp3)/g).sort();
    const actualImages = getMatches(html, /images\/([^"]+\.jpg)/g).sort();

    report.push({
      chapter: chapter.n,
      title: chapter.title,
      actualAudio,
      actualImages,
      configuredAudio: chapter.clips.map((clip) => `${clip}.mp3`),
      configuredImages: chapter.imgs.map((img) => `${img}.jpg`),
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
