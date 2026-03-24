#!/usr/bin/env node
/**
 * Crawl Let's Learn Kashmiri chapter pages to find content images.
 * Outputs the image data needed to update courses.ts.
 */

const HEADERS = {
  'Referer': 'https://koshur.org/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
};

// Chapters 2-13 (chapter 1 is the intro/TOC, skipped as per off-by-one fix)
const chapters = [];
for (let n = 1; n <= 12; n++) {
  chapters.push({
    chapterNum: n,
    pageNum: n + 1, // page chapter2 = lesson 1, chapter3 = lesson 2, etc.
  });
}

async function fetchPage(url) {
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

function extractContentImages(html, chapterPageNum) {
  // Find all img tags
  const imgPattern = /<img[^>]+src=["']([^"']+)["']/gi;
  const allImages = [];
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    allImages.push(match[1]);
  }

  // Filter to content images only (images/N.jpg pattern within the chapter)
  const chapterImages = allImages
    .filter(src => /^images\/\d+\.jpg$/i.test(src))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  // Also find shared images (../images/ii.N.jpg or ../images/N.jpg patterns)
  const sharedImages = allImages
    .filter(src => /^\.\.\/images\/(ii\.)?\d+\.jpg$/i.test(src))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  // Deduplicate
  const unique = [...new Set([...sharedImages, ...chapterImages])];

  return { chapterImages, sharedImages, unique };
}

async function main() {
  const results = [];

  for (const ch of chapters) {
    const url = `https://koshur.org/LearnKashmiri/chapter${ch.pageNum}/`;
    process.stdout.write(`Chapter ${ch.chapterNum} (page chapter${ch.pageNum})... `);

    try {
      const html = await fetchPage(url);
      const images = extractContentImages(html, ch.pageNum);

      console.log(`${images.chapterImages.length} chapter imgs, ${images.sharedImages.length} shared imgs`);

      results.push({
        lessonNum: ch.chapterNum,
        pageNum: ch.pageNum,
        chapterImages: images.chapterImages,
        sharedImages: images.sharedImages,
        imageBaseUrl: `https://koshur.org/LearnKashmiri/chapter${ch.pageNum}/`,
        sharedImageBaseUrl: `https://koshur.org/LearnKashmiri/`,
      });
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({ lessonNum: ch.chapterNum, pageNum: ch.pageNum, chapterImages: [], sharedImages: [] });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Output as JSON for use in courses.ts update
  console.log('\n--- Results ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
