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

const spokenKashmiriChapters = vm.runInNewContext(
  extractArraySource('spokenKashmiriChapters')
);

function head(url) {
  return new Promise((resolve) => {
    const request = https.request(
      url,
      {
        method: 'HEAD',
        headers: {
          Referer: 'https://koshur.org/',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (res) => {
        resolve(res.statusCode || 0);
        res.resume();
      }
    );

    request.on('error', () => resolve(0));
    request.end();
  });
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const results = [];

  async function take() {
    while (queue.length > 0) {
      const item = queue.shift();
      results.push(await worker(item));
    }
  }

  await Promise.all(Array.from({ length: limit }, take));
  return results;
}

async function main() {
  const checks = spokenKashmiriChapters.flatMap((chapter) =>
    chapter.clips.map((clip) => ({
      chapter: chapter.n,
      clip,
      url: `https://koshur.org/SpokenKashmiri/Chapter${chapter.n}/audio/${clip}.mp3`,
    }))
  );

  const results = await runWithConcurrency(checks, 20, async (check) => ({
    ...check,
    status: await head(check.url),
  }));

  const failures = results.filter((result) => result.status !== 200);
  console.log(JSON.stringify(failures, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
