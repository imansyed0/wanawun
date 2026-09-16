---
name: release-build
description: Ship Wanwun — merge a branch to main, start EAS iOS/Android production builds, and get them submitted to TestFlight and Play internal testing. Use when asked to release, cut a build, merge and build, push a new version to testers, or check whether a finished build actually reached testers.
---

# Release build

How a branch becomes a build in TestFlight and Play internal testing.

A release is four steps, and the fourth is the one that gets skipped:

1. Merge to `main` via a PR.
2. Start a `production` build for each platform.
3. Wait for the build to finish (6–20 min).
4. **Submit it.** A finished build is not a shipped build — see
   [Submission](#submission). This does not happen by itself unless you asked
   for it when you started the build.

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

Build from merged `main`, so what testers get matches what shipped. Check what
you're about to build actually is that merge:

```bash
git log --oneline -1
```

EAS records the commit on the build, so you can confirm afterwards that the
build and the merge agree (`Commit` in `build:list`).

## Two routes, and only one of them submits

This is the decision that matters, and getting it wrong leaves a finished
artifact sitting on EAS doing nothing.

| | CI (`workflow_dispatch`) | By hand (`eas build`) |
|---|---|---|
| Submits to testers | **Yes**, automatically, for `production` | **Only if you pass `--auto-submit`** |
| Where it runs | GitHub Actions runner | Your machine kicks it off; EAS builds it |
| Use when | Normal releases | You need a flag CI doesn't pass |

### Route A — GitHub Actions (preferred)

```bash
gh workflow run eas-build.yml -f platform=all -f profile=production
```

`platform` is `android` / `ios` / `all`; `profile` is `preview` / `production`.
The workflow (`.github/workflows/eas-build.yml`) adds `--auto-submit` whenever
the profile is `production`, so TestFlight and the Play internal track are fed
without a second command. It always builds the default branch's checkout.

Watch it:

```bash
gh run list --workflow=eas-build.yml --limit 3
```

The run itself finishes in about a minute — it only *starts* the builds
(`--no-wait`). Don't read a green check as "the build passed"; it means the
build was queued. Go look at EAS for the real outcome.

The workflow also fires on a push of an `eas-build-*` tag, or a push to a
`claude/**` branch that touches `.github/build-trigger/**`. That last one is how
an agent branch triggers a build without dispatch access: add a file describing
the build, and the push starts it.

```
.github/build-trigger/2026-04-26-android-preview.txt
  platform: android
  profile: preview
  note: First private-beta APK after PKCE auth-callback fix.
```

Note the trigger file's contents are documentation for humans — the workflow
reads its *inputs*, and on a push those default to `android` / `preview`.

### Route B — by hand

If you start builds from a terminal, **pass `--auto-submit` yourself** or you
will have to submit afterwards:

```bash
npx --yes eas-cli@latest build --platform android --profile production --non-interactive --no-wait --auto-submit
```

```bash
npx --yes eas-cli@latest build --platform ios --profile production --non-interactive --no-wait --auto-submit
```

Each prints a build URL. `--no-wait` returns immediately; EAS schedules the
submission server-side once the build finishes, using the App Store Connect key
and Google service account stored in EAS credentials, so `--no-wait` and
`--auto-submit` work together fine.

Check on them:

```bash
npx --yes eas-cli@latest build:list --limit 2 --non-interactive
```

Statuses go `in queue` → `in progress` → `finished`. iOS has been taking ~6 min
and Android ~19 min on `production`.

## Submission

**Verify it, don't assume it.** A build that was started without
`--auto-submit` finishes looking completely healthy and is never sent anywhere.
This one-liner is the check:

```bash
npx --yes eas-cli@latest build:list --limit 2 --json --non-interactive | jq -r '.[] | "\(.platform) build \(.appBuildVersion // .appVersion)  \(.status)  submissions: \(.submissions | length)"'
```

```
IOS build 7  FINISHED  submissions: 0
ANDROID build 7  FINISHED  submissions: 0
```

`submissions: 0` on a `FINISHED` production build means it never went to
testers. Send it now — no rebuild, same artifact, same version:

```bash
npx --yes eas-cli@latest submit --platform ios --latest --non-interactive
```

```bash
npx --yes eas-cli@latest submit --platform android --latest --non-interactive
```

`--latest` picks the most recent finished build for that platform, so it is only
correct if nothing newer has been built since. Otherwise pass `--id <build-id>`.

Submitting pushes a build to real testers. Confirm with the user before running
it unless they already asked for the release to go out.

The history of what has actually shipped:

```bash
npx --yes eas-cli@latest submit:list --limit 5 --non-interactive
```

## Profiles

| Profile | What it does |
|---|---|
| `development` | Dev client, internal distribution |
| `preview` | Internal distribution; Android as an installable APK. Use this for testing on your own devices first |
| `production` | Auto-increments the version, and `submit.production` in `eas.json` targets TestFlight (`ascAppId` 6811425194) and the Play internal track |

## Version numbers

`eas.json` sets `"appVersionSource": "remote"`, so **EAS owns the build number,
not the repo.** `app.json` holds the marketing version (`1.0.0`) and nothing in
git records the build number; `autoIncrement` on the `production` profile bumps
it server-side each time. iOS build number and Android versionCode advance
together — build 7 was the last of both.

The practical consequence: every `production` build burns a version, even one
you abandon. Re-running a release because the first one wasn't submitted gives
testers a *new* build number for identical code. Prefer `submit --latest` over
rebuilding.

## Gotchas

- **A finished build is not a submitted build.** Builds started by hand without
  `--auto-submit` sit on EAS indefinitely. The workflow passes the flag; a
  terminal doesn't. This has already happened once on this project — two
  `production` builds finished and sat unsubmitted overnight because they were
  started with a bare `eas build`. Run the `submissions:` check above at the end
  of every release.
- **A green GitHub Actions run does not mean a successful build.** The job
  exits after queueing (`--no-wait`), roughly a minute in. Build failures show
  up only on EAS.
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
- **`EXPO_NO_CAPABILITY_SYNC=1` is set in CI**, because Apple's capability sync
  API rejected this bundle ID and the app uses no capabilities it would enable.
  A hand-run build that hits that error needs the same env var.
- **Native code is never run locally here.** `npm run ios` / `npm run android` need
  Xcode or Android Studio; the web build is what gets driven in development (see
  the `run-wanawun` skill).
- **Supabase redirect URLs are environment config, not code.** Email confirmation
  and password reset links break silently if the redirect isn't on the allowlist in
  the Supabase dashboard — and a build can't fix that, because it isn't in the
  build.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build finished but testers see nothing | `submissions: 0` — submit it: `eas submit --platform <p> --latest` |
| `gh workflow run` says the workflow isn't found | You're not on a branch whose default-branch copy has it; dispatch reads the workflow from the default branch |
| Workflow run is green but no build appears on EAS | `EXPO_TOKEN` secret is missing or expired — check the "Setup EAS" step's log |
| `eas submit --latest` submits the wrong thing | A newer build exists; pass `--id <build-id>` from `build:list` |
| iOS build fails on capability sync | Set `EXPO_NO_CAPABILITY_SYNC=1` in the environment that runs `eas build` |
