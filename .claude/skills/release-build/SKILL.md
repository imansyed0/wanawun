---
name: release-build
description: Ship Wanwun — merge a branch to main and start EAS iOS/Android builds that submit to TestFlight and Play internal testing. Use when asked to release, cut a build, merge and build, or push a new version to testers.
---

# Release build

How a branch becomes a build in TestFlight and Play internal testing.

Paths are relative to the repo root.

## Prerequisites

```bash
gh auth status                       # GitHub CLI, logged in
npx --yes eas-cli@latest whoami      # Expo account (eas-cli is not installed locally)
```

## Merge to main

`main` is not protected, but the repo's history is PR merges — keep that:

```bash
npx tsc --noEmit                     # the only check in the repo; no test script exists
git push
gh pr create --base main --head "$(git branch --show-current)" --title "…" --body "…"
gh pr merge <number> --merge
git checkout main && git pull --ff-only
```

Build from merged `main`, so what testers get matches what shipped.

## Start the builds

```bash
npx --yes eas-cli@latest build --platform android --profile production --non-interactive --no-wait
npx --yes eas-cli@latest build --platform ios --profile production --non-interactive --no-wait
```

Each prints a build URL. `--no-wait` returns immediately; production builds take
roughly 10–25 minutes.

Check on them:

```bash
npx --yes eas-cli@latest build:list --limit 2 --non-interactive
```

Statuses go `in queue` → `in progress` → `finished`.

## Profiles

| Profile | What it does |
|---|---|
| `development` | Dev client, internal distribution |
| `preview` | Internal distribution; Android as an installable APK. Use this for testing on your own devices first |
| `production` | Auto-increments the version, and `submit.production` in `eas.json` targets TestFlight and the Play internal track |

## Submission

Production builds can submit themselves. The GitHub workflow
(`.github/workflows/eas-build.yml`) passes `--auto-submit`; run by hand, add it
yourself, or submit afterwards:

```bash
npx --yes eas-cli@latest submit --platform ios --latest
```

EAS schedules submission server-side using the App Store Connect key and Google
service account stored in EAS credentials, so `--no-wait` still submits.

## Building from CI instead

`.github/workflows/eas-build.yml` runs the same thing on `workflow_dispatch` with
platform and profile inputs, or on tags matching `eas-build-*`. It sets
`EXPO_NO_CAPABILITY_SYNC=1`, because Apple's capability sync API rejected this
bundle ID and the app uses no capabilities it would enable.

## Gotchas

- **Android Google sign-in depends on which key signed the build.** Play-installed
  builds carry the Play app signing key, so its SHA-1 must be on an Android OAuth
  client in Google Cloud, and the web client ID must be listed in Supabase's Google
  provider. A `preview` APK installed directly uses the EAS upload key instead —
  different SHA-1, so register both or sign-in fails with `DEVELOPER_ERROR`
  (`[code 10]`).
- **`production` bumps the version** (`autoIncrement`), so don't start one to "just
  check it compiles" — use `preview`.
- **`eas-cli` is not a dependency.** Always `npx --yes eas-cli@latest`; a bare
  `npx eas-cli` refuses to install non-interactively.
- **Native code is never run locally here.** `npm run ios` / `npm run android` need
  Xcode or Android Studio; the web build is what gets driven in development (see
  the `run-wanawun` skill).
- **Supabase redirect URLs are environment config, not code.** Email confirmation
  and password reset links break silently if the redirect isn't on the allowlist in
  the Supabase dashboard.
