#!/usr/bin/env node
// Drives the Wanwun web build (Expo Router + React Native Web) over CDP.
//
// Why this exists, rather than "open localhost:8081 and click":
//   * Signing in is mandatory. With no session the app renders the welcome
//     screen and nothing else is reachable, so the driver signs in through
//     Supabase's REST API and injects the session into localStorage before
//     the app boots.
//   * React Native Web's Pressable listens for pointer events, so a synthetic
//     element.click() does nothing. Every tap here is a real CDP mouse event.
//   * Several tab screens stay mounted at once, so document.body.innerText
//     mixes screens together. `text` and `find` only look at boxes that are
//     actually on screen.
//
// Usage:
//   node .claude/skills/run-wanawun/driver.mjs shot glossary.png
//   node .claude/skills/run-wanawun/driver.mjs goto /lessons shot lessons.png
//   node .claude/skills/run-wanawun/driver.mjs find "Replay Naani"
//   node .claude/skills/run-wanawun/driver.mjs tap "Lessons" shot tab.png
//   node .claude/skills/run-wanawun/driver.mjs eval "location.pathname"
//   node .claude/skills/run-wanawun/driver.mjs --headful shot look.png
//
// Env (read from .env if present):
//   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY  (required)
//   WANWUN_EMAIL, WANWUN_PASSWORD   sign in as this account
//   WANWUN_URL                      default http://localhost:8081
//   WANWUN_SHOT_DIR                 default .claude/skills/run-wanawun/shots

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const APP_URL = process.env.WANWUN_URL || 'http://localhost:8081';
const SHOT_DIR = process.env.WANWUN_SHOT_DIR || '.claude/skills/run-wanawun/shots';
const HEADFUL = process.argv.includes('--headful');
const args = process.argv.slice(2).filter((a) => a !== '--headful');

// --- .env ------------------------------------------------------------------

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// --- browser ---------------------------------------------------------------

function chromeBinary() {
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (existsSync(base)) {
    const shell = readdirSync(base).find((d) => d.startsWith('chromium_headless_shell-'));
    if (shell && !HEADFUL) {
      const p = path.join(base, shell, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
      if (existsSync(p)) return p;
    }
    const full = readdirSync(base).find((d) => d.startsWith('chromium-'));
    if (full) {
      const p = path.join(
        base, full, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
      );
      if (existsSync(p)) return p;
    }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(chrome)) return chrome;
  throw new Error('No Chromium found. Install one: npx --yes playwright install chromium');
}

async function launch() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(chromeBinary(), [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=430,900',
    `--user-data-dir=${path.join(os.tmpdir(), 'wanwun-driver-profile')}`,
    ...(HEADFUL ? [] : ['--headless=new']),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr.on('data', () => {});

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return { proc, port, info: await r.json() };
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error('Chromium did not expose a debugging port');
}

// Minimal CDP client over the raw WebSocket Node ships with.
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      }
    });
  }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate failed');
    return r.result.value;
  }
}

// --- session ---------------------------------------------------------------

async function signIn() {
  // Either spelling: the repo still uses the old "wanawun" slug in places.
  const email = process.env.WANWUN_EMAIL || process.env.WANAWUN_EMAIL;
  const password = process.env.WANWUN_PASSWORD || process.env.WANAWUN_PASSWORD;
  if (!email || !password) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`Sign-in failed: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

/** Supabase keys its web session by project ref, taken from the URL. */
function storageKey() {
  const ref = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];
  return `sb-${ref}-auth-token`;
}

// --- commands --------------------------------------------------------------

/** Only elements with a real box inside the viewport: other tab screens stay mounted. */
const VISIBLE_HELPER = `
  const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  const labelled = [];
  for (const el of document.querySelectorAll('div,button,span,input')) {
    const r = el.getBoundingClientRect();
    if (!inView(r)) continue;
    const label = (el.getAttribute('aria-label') || (el.childElementCount === 0 ? el.textContent : '') || '').trim();
    if (!label || label.length > 60) continue;
    labelled.push({ label, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
  }
`;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (.env)');
    process.exit(1);
  }

  const { proc, port } = await launch();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const cdp = await Cdp.connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const exit = async (code = 0) => { proc.kill(); process.exit(code); };

  try {
    // Seed the session on the app's origin before any app code runs.
    const session = await signIn();
    await cdp.send('Page.navigate', { url: `${APP_URL}/` });
    await new Promise((r) => setTimeout(r, 1500));
    if (session) {
      await cdp.eval(`
        localStorage.setItem(${JSON.stringify(storageKey())}, ${JSON.stringify(JSON.stringify(session))});
        return 'seeded';
      `);
      await cdp.send('Page.navigate', { url: `${APP_URL}/` });
    }
    // Metro serves a big dev bundle; first paint takes a few seconds.
    await new Promise((r) => setTimeout(r, 8000));

    let i = 0;
    while (i < args.length) {
      const cmd = args[i++];

      if (cmd === 'goto') {
        const route = args[i++];
        await cdp.send('Page.navigate', { url: `${APP_URL}${route}` });
        await new Promise((r) => setTimeout(r, 6000));
        console.log(`goto ${route} -> ${await cdp.eval('return location.pathname')}`);

      } else if (cmd === 'shot') {
        const name = args[i++] || 'shot.png';
        mkdirSync(path.join(ROOT, SHOT_DIR), { recursive: true });
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, SHOT_DIR, name);
        writeFileSync(file, Buffer.from(data, 'base64'));
        console.log(`shot -> ${path.relative(ROOT, file)}`);

      } else if (cmd === 'find') {
        const needle = args[i++];
        const hits = await cdp.eval(`${VISIBLE_HELPER}
          return labelled.filter(e => e.label.toLowerCase().includes(${JSON.stringify(needle)}.toLowerCase())).slice(0, 10);
        `);
        console.log(JSON.stringify(hits, null, 2));

      } else if (cmd === 'tap') {
        // Real mouse events: Pressable ignores element.click().
        const needle = args[i++];
        const hit = await cdp.eval(`${VISIBLE_HELPER}
          return labelled.find(e => e.label.toLowerCase().includes(${JSON.stringify(needle)}.toLowerCase())) || null;
        `);
        if (!hit) { console.error(`tap: nothing on screen matching ${needle}`); await exit(1); }
        for (const type of ['mousePressed', 'mouseReleased']) {
          await cdp.send('Input.dispatchMouseEvent', {
            type, x: hit.x, y: hit.y, button: 'left', clickCount: 1,
          });
        }
        await new Promise((r) => setTimeout(r, 2500));
        console.log(`tap "${hit.label}" at ${hit.x},${hit.y} -> ${await cdp.eval('return location.pathname')}`);

      } else if (cmd === 'text') {
        const out = await cdp.eval(`${VISIBLE_HELPER}
          return labelled.map(e => e.label).slice(0, 40);
        `);
        console.log(out.join('\n'));

      } else if (cmd === 'eval') {
        console.log(JSON.stringify(await cdp.eval(`return (${args[i++]})`), null, 2));

      } else {
        console.error(`unknown command: ${cmd}`);
        await exit(1);
      }
    }
    await exit(0);
  } catch (err) {
    console.error(String(err.message || err));
    await exit(1);
  }
}

main();
