// Scrapes r/kashmiri's top-of-all-time posts via Reddit's public JSON API and
// flags posts that look like advertisements/self-promotion (outbound links to
// social/storefront domains, promo keywords in title or selftext, promo flair).
//
// Output:
//   data/reddit_kashmiri_top.json    - every post fetched, in listing order
//   data/reddit_kashmiri_ads.json    - the subset flagged as advertisement-like
//   data/reddit_kashmiri_ads.md      - human-readable report of the flagged subset
//
// Run with:  node data/scrape_reddit_kashmiri.js
//
// Notes:
//   - Reddit's "top of all time" listing is capped at ~1000 posts per sort.
//   - No auth required for the .json endpoint, but a descriptive User-Agent is.
//   - Be polite: this script sleeps between paginated requests.

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUBREDDIT = 'kashmiri';
const PAGE_SIZE = 100;
const MAX_PAGES = 10; // 10 * 100 = up to 1000 posts (Reddit's hard cap)
const SLEEP_MS = 1500;

const OUT_DIR = path.join(__dirname);
const OUT_ALL = path.join(OUT_DIR, 'reddit_kashmiri_top.json');
const OUT_ADS = path.join(OUT_DIR, 'reddit_kashmiri_ads.json');
const OUT_MD = path.join(OUT_DIR, 'reddit_kashmiri_ads.md');

const HEADERS = {
  'User-Agent': 'wanawun-research/0.1 (kashmiri-language-app; contact: github.com/imansyed0/wanawun)',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Domains that mean the post is just a regular Reddit text/image/video post.
const REDDIT_DOMAINS = new Set([
  'self.kashmiri',
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'i.redd.it',
  'v.redd.it',
  'redd.it',
  'reddit.app.link',
]);

// Domains that almost always indicate self-promotion / advertising / fundraising.
const PROMO_DOMAIN_PATTERNS = [
  /(^|\.)instagram\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)fb\.watch$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)telegram\.me$/i,
  /(^|\.)whatsapp\.com$/i,
  /(^|\.)wa\.me$/i,
  /(^|\.)snapchat\.com$/i,
  /(^|\.)threads\.net$/i,
  /(^|\.)linktr\.ee$/i,
  /(^|\.)beacons\.ai$/i,
  /(^|\.)bio\.link$/i,
  /(^|\.)patreon\.com$/i,
  /(^|\.)ko-fi\.com$/i,
  /(^|\.)buymeacoffee\.com$/i,
  /(^|\.)substack\.com$/i,
  /(^|\.)medium\.com$/i,
  /(^|\.)gumroad\.com$/i,
  /(^|\.)kickstarter\.com$/i,
  /(^|\.)indiegogo\.com$/i,
  /(^|\.)gofundme\.com$/i,
  /(^|\.)ketto\.org$/i,
  /(^|\.)milaap\.org$/i,
  /(^|\.)etsy\.com$/i,
  /(^|\.)amazon\.[a-z.]+$/i,
  /(^|\.)flipkart\.com$/i,
  /(^|\.)myntra\.com$/i,
  /(^|\.)meesho\.com$/i,
  /(^|\.)shopify\.com$/i,
  /\.myshopify\.com$/i,
  /(^|\.)spotify\.com$/i,
  /(^|\.)open\.spotify\.com$/i,
  /(^|\.)apple\.com$/i, // apps / podcasts / music
  /(^|\.)podcasts\.apple\.com$/i,
  /(^|\.)play\.google\.com$/i,
  /(^|\.)apps\.apple\.com$/i,
  /(^|\.)bandcamp\.com$/i,
  /(^|\.)soundcloud\.com$/i,
  /(^|\.)razorpay\.com$/i,
  /(^|\.)paypal\.com$/i,
  /(^|\.)paypal\.me$/i,
  /(^|\.)twitch\.tv$/i,
  /(^|\.)discord\.gg$/i,
  /(^|\.)discord\.com$/i,
  /(^|\.)chess\.com$/i,
];

// Phrases that strongly suggest promotion/self-promo when they appear in the
// title or selftext (case-insensitive). Keep these specific to avoid noise.
const PROMO_KEYWORDS = [
  'check out my',
  'check out our',
  'check it out',
  'link in bio',
  'link in comments',
  'link below',
  'link in the description',
  'follow my',
  'follow me on',
  'follow us on',
  'subscribe to my',
  'subscribe to our',
  'please subscribe',
  'kindly subscribe',
  'my channel',
  'my youtube',
  'my instagram',
  'my podcast',
  'my page',
  'my book',
  'my blog',
  'our brand',
  'our app',
  'our website',
  'our store',
  'our shop',
  'our channel',
  'our page',
  'our podcast',
  'our youtube',
  'launching',
  'just launched',
  'now available',
  'available at',
  'available on',
  'pre-order',
  'preorder',
  'shop now',
  'buy now',
  'use code',
  'promo code',
  'coupon code',
  'discount code',
  'flat off',
  '% off',
  'limited offer',
  'limited edition',
  'fundraiser',
  'fund raiser',
  'donate to',
  'please donate',
  'kindly donate',
  'support my',
  'support our',
  'please support',
  'kindly support',
  'crowdfund',
  'crowdfunding',
  'kickstarter',
  'gofundme',
  'patreon',
  'dm me',
  'dm for',
  'dm to order',
  'whatsapp me',
  'message me',
  'order now',
  'cash on delivery',
  'cod available',
  'free shipping',
  'small business',
  'start-up',
  'startup',
  'we are hiring',
  'now hiring',
  'apply now',
  'register now',
  'sign up',
  'signup',
  'enroll now',
  'join my',
  'join our',
  'survey',
  'questionnaire',
  'beta test',
  'beta testers',
  'beta-testers',
];

const PROMO_FLAIRS = [
  /promo/i,
  /\bad\b/i,
  /advert/i,
  /self[-\s]?promo/i,
  /announcement/i,
  /event/i,
  /survey/i,
  /fundrais/i,
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: HEADERS }, (res) => {
        if (res.statusCode === 429) {
          reject(new Error(`HTTP 429 (rate limited) for ${url}`));
          res.resume();
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Bad JSON from ${url}: ${err.message}`));
          }
        });
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickFields(child) {
  const d = child.data || {};
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    score: d.score,
    ups: d.ups,
    upvote_ratio: d.upvote_ratio,
    num_comments: d.num_comments,
    created_utc: d.created_utc,
    created_iso: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
    permalink: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
    url: d.url_overridden_by_dest || d.url,
    domain: d.domain,
    is_self: d.is_self,
    is_video: d.is_video,
    over_18: d.over_18,
    spoiler: d.spoiler,
    stickied: d.stickied,
    link_flair_text: d.link_flair_text,
    selftext: d.selftext || '',
    total_awards_received: d.total_awards_received,
    distinguished: d.distinguished,
    post_hint: d.post_hint,
    media_domain: d.media && d.media.type ? d.media.type : null,
  };
}

function classify(post) {
  const reasons = [];
  const haystack = `${post.title || ''}\n${post.selftext || ''}`.toLowerCase();
  const domain = (post.domain || '').toLowerCase();

  // Outbound link to a known promo / storefront / social domain.
  if (domain && !REDDIT_DOMAINS.has(domain)) {
    for (const re of PROMO_DOMAIN_PATTERNS) {
      if (re.test(domain)) {
        reasons.push(`outbound link to promo domain: ${domain}`);
        break;
      }
    }
  }

  // Promo keywords in title or selftext.
  const matchedKeywords = [];
  for (const kw of PROMO_KEYWORDS) {
    if (haystack.includes(kw)) matchedKeywords.push(kw);
  }
  if (matchedKeywords.length > 0) {
    reasons.push(`promo keywords: ${matchedKeywords.slice(0, 5).join(', ')}`);
  }

  // Flair-based signal.
  if (post.link_flair_text) {
    for (const re of PROMO_FLAIRS) {
      if (re.test(post.link_flair_text)) {
        reasons.push(`flair: ${post.link_flair_text}`);
        break;
      }
    }
  }

  // Bare URL in selftext that points to a promo domain.
  if (post.selftext) {
    const urls = post.selftext.match(/https?:\/\/[^\s)\]]+/g) || [];
    for (const u of urls) {
      try {
        const host = new URL(u).hostname.toLowerCase();
        if (REDDIT_DOMAINS.has(host)) continue;
        for (const re of PROMO_DOMAIN_PATTERNS) {
          if (re.test(host)) {
            reasons.push(`selftext links out to: ${host}`);
            break;
          }
        }
      } catch (_e) {
        // ignore malformed URLs
      }
    }
  }

  return {
    is_advertisement: reasons.length > 0,
    reasons: Array.from(new Set(reasons)),
  };
}

async function fetchAllTop() {
  const all = [];
  let after = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      t: 'all',
      limit: String(PAGE_SIZE),
      raw_json: '1',
    });
    if (after) params.set('after', after);
    const url = `https://www.reddit.com/r/${SUBREDDIT}/top.json?${params.toString()}`;
    console.log(`Fetching page ${page + 1}: ${url}`);
    let body;
    try {
      body = await fetchJson(url);
    } catch (err) {
      console.error(`Page ${page + 1} failed: ${err.message}`);
      break;
    }
    const children = (body && body.data && body.data.children) || [];
    if (children.length === 0) {
      console.log('No more posts.');
      break;
    }
    for (const c of children) all.push(pickFields(c));
    after = (body.data && body.data.after) || null;
    if (!after) {
      console.log('Reached end of listing.');
      break;
    }
    await sleep(SLEEP_MS);
  }
  return all;
}

function buildMarkdown(ads) {
  const lines = [];
  lines.push(`# r/${SUBREDDIT} - flagged advertisement-like posts (top of all time)`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total flagged: ${ads.length}`);
  lines.push('');
  lines.push('Heuristics: outbound links to social/storefront/fundraising domains,');
  lines.push('promo keywords in title or selftext, or promo-style flair.');
  lines.push('');
  for (const p of ads) {
    lines.push(`## ${p.score} ↑  ${p.title}`);
    lines.push('');
    lines.push(`- author: u/${p.author}`);
    lines.push(`- created: ${p.created_iso}`);
    lines.push(`- comments: ${p.num_comments}, upvote_ratio: ${p.upvote_ratio}`);
    if (p.link_flair_text) lines.push(`- flair: ${p.link_flair_text}`);
    lines.push(`- domain: ${p.domain}`);
    lines.push(`- url: ${p.url}`);
    lines.push(`- permalink: ${p.permalink}`);
    lines.push(`- reasons: ${p._classification.reasons.join(' | ')}`);
    if (p.selftext) {
      const snippet = p.selftext.replace(/\s+/g, ' ').slice(0, 400);
      lines.push('');
      lines.push('> ' + snippet + (p.selftext.length > 400 ? '...' : ''));
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const all = await fetchAllTop();
  console.log(`Fetched ${all.length} posts total.`);

  for (const p of all) p._classification = classify(p);
  const ads = all
    .filter((p) => p._classification.is_advertisement)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  fs.writeFileSync(OUT_ALL, JSON.stringify(all, null, 2), 'utf8');
  fs.writeFileSync(OUT_ADS, JSON.stringify(ads, null, 2), 'utf8');
  fs.writeFileSync(OUT_MD, buildMarkdown(ads), 'utf8');

  console.log(`Saved ${all.length} posts to ${OUT_ALL}`);
  console.log(`Flagged ${ads.length} advertisement-like posts -> ${OUT_ADS}`);
  console.log(`Wrote markdown report -> ${OUT_MD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
