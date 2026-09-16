---
name: run-wanawun
description: Build, run, screenshot and drive the Wanwun app (Expo Router + React Native Web + Supabase). Use when asked to run the app, start the dev server, take a screenshot, click through a screen, verify a UI change in the browser, or drive the app programmatically.
---

# Run Wanwun

Wanwun is an Expo Router app (React Native + React Native Web, SDK 55) backed by
Supabase. The web build is the only surface you can drive from a terminal, and
`.claude/skills/run-wanawun/driver.mjs` is how you drive it: it launches headless
Chromium over CDP, signs in, and gives you `goto` / `shot` / `tap` / `find` /
`text` / `eval`.

All paths below are relative to the repo root.

## Prerequisites

Node and npm (verified on Node v26.8.2, npm 11.19.1), plus a Chromium. The driver
looks for Playwright's cached browser first, then falls back to system Chrome:

```bash
ls ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

If that prints nothing:

```bash
npx --yes playwright install chromium
```

`.env` must exist with the Supabase keys (it is gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

## Setup

```bash
npm install
```

## Run (agent path)

Start the dev server in the background and leave it running — Metro takes several
seconds to serve its first bundle:

```bash
npx expo start --web
```

Then drive it. Commands run in sequence in one browser session:

```bash
node .claude/skills/run-wanawun/driver.mjs shot 01-welcome.png text
node .claude/skills/run-wanawun/driver.mjs tap "Get started" shot 02-level.png text
node .claude/skills/run-wanawun/driver.mjs goto /lessons shot lessons.png
node .claude/skills/run-wanawun/driver.mjs find "Replay Naani"
node .claude/skills/run-wanawun/driver.mjs eval "location.pathname"
```

Output of the first command, verbatim:

```
shot -> .claude/skills/run-wanawun/shots/01-welcome.png
Salaam, jaanu. I’m Naani.
Come, we’ll learn Koshur together!
Get started
I already have an account
```

Screenshots land in `.claude/skills/run-wanawun/shots/`. **Open them.** A PNG on
disk is not evidence; a rendered screen is.

Commands:

| Command | What it does |
|---|---|
| `shot <name.png>` | Screenshot into `shots/` |
| `text` | Every label currently **on screen** (see the mounted-screens gotcha) |
| `find <needle>` | On-screen elements matching, with tap coordinates |
| `tap <needle>` | Real CDP mouse press/release on the first match |
| `goto <route>` | Navigate, e.g. `/learn`, `/lessons`, `/profile` |
| `eval <expr>` | Evaluate in the page, printed as JSON |
| `--headful` | Watch it in a real window instead of headless |

### Signing in

**Everything except the welcome and sign-in screens is behind mandatory sign-in.**
Without credentials the driver reaches `/welcome` and stops there. Give it an
account and it signs in through Supabase's REST API and injects the session into
`localStorage` before the app boots:

```bash
WANWUN_EMAIL=you@example.com WANWUN_PASSWORD='…' \
  node .claude/skills/run-wanawun/driver.mjs goto /learn shot glossary.png text
```

Put those in `.env` to avoid repeating them. Never commit them.

## Run (human path)

```bash
npx expo start --web     # opens http://localhost:8081 in a browser
npx expo start           # QR code for Expo Go / a dev build on a phone
```

Native builds (`npm run ios`, `npm run android`) need Xcode or Android Studio and
were not run here.

## Verify a change

There is no test suite in `package.json`. The check that exists, and the one used
throughout development:

```bash
npx tsc --noEmit
```

## Gotchas

- **Synthetic clicks do nothing.** React Native Web's `Pressable` listens for
  pointer events, so `element.click()` from page JS silently no-ops — it returns
  success and nothing happens. `tap` dispatches real `Input.dispatchMouseEvent`
  presses. `Text` elements *do* respond to `.click()`, which makes this even more
  confusing: some taps work and some don't.
- **Several tab screens stay mounted at once.** `document.body.innerText` returns
  the Glossary's rows while the Flashcards tab is on screen, so text assertions
  across screens are meaningless. `text` and `find` only consider elements whose
  bounding box is inside the viewport.
- **Coordinate frames differ.** Page JS reports CSS pixels (~435×814); screenshots
  come back in a different frame. Don't convert between them by hand — use `tap`,
  which measures and clicks in the same frame.
- **The + button is always present.** It is mounted in the root layout, so it
  appears in `text` output even on the welcome screen.
- **`expo-audio` players never enter the DOM.** `document.querySelectorAll('audio')`
  returns nothing even while audio plays. To prove playback happened, look for the
  request instead:
  ```bash
  node .claude/skills/run-wanawun/driver.mjs eval "performance.getEntriesByType('resource').filter(e => e.name.includes('.mp3')).map(e => e.name.slice(-30))"
  ```
- **The microphone is blocked headless.** Recording fails with "Microphone
  permission is required". To exercise a recording flow, stub it before tapping
  record:
  ```js
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    return ctx.createMediaStreamDestination().stream;
  };
  ```
- **Naani's tour lives in memory.** Any page reload ends it. Replay it from
  Profile → "Replay Naani's tour"; see the `naani-tour` skill.
- **Metro's first bundle is slow.** The driver waits 8s after load and 6s after
  each `goto`. A blank screenshot usually means it raced the bundle, not that
  something broke.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No Chromium found` | `npx --yes playwright install chromium` |
| `Chromium did not expose a debugging port` | A stale profile lock: `rm -rf $TMPDIR/wanwun-driver-profile` |
| `Sign-in failed: HTTP 400` | Wrong `WANWUN_EMAIL` / `WANWUN_PASSWORD`, or the account never confirmed its email |
| Driver stops on `/welcome` | No credentials set — that's the signed-out path, not a failure |
| `tap: nothing on screen matching X` | The label is off-screen or on another mounted screen; run `text` first to see what's actually visible |
| Screenshot is blank | Metro was still bundling; re-run, or raise the waits in the driver |
| `HTTP 404` from the dev server | `npx expo start --web` isn't running, or it picked another port |
