---
name: screen-sizes
description: Check a Wanwun screen's layout across phone and tablet sizes — clipped content, things buried under the tab bar, sideways scroll. Use after changing any screen's layout, when a tester reports something looking wrong or cut off on their phone, or before shipping a build with layout changes.
---

# Screen sizes

The dev browser is one window, usually a roomy one. Every layout bug this app
has shipped has been invisible there and obvious on a phone.

```bash
.claude/skills/screen-sizes/check.sh /flashcards
.claude/skills/screen-sizes/check.sh /flashcards "Reveal answer"
SIZES="375x812 390x772" .claude/skills/screen-sizes/check.sh /learn
```

Prints `OK` per size, or the breakage. Exits non-zero if anything broke, so it
can gate a release. Needs the dev server (`npx expo start --web`) and the same
credentials as [run-wanawun](../run-wanawun/SKILL.md), whose driver and signed-in
profile it reuses.

## What it checks

| Check | Why it matters |
|---|---|
| Content clipped by an `overflow: hidden` ancestor | What a card looks like when its contents stop fitting — the answer sliced in half mid-word |
| Elements under the tab bar | The tab bar paints over them, so they're simply gone |
| Horizontal overflow | Always a bug on a phone |

`probe.js` is the whole of it, and runs through `driver.mjs eval`. Paste it in
directly when you want to poke at one size by hand.

## Sizes, and why some look odd

```
360x600  360x640  375x667  375x740  375x812  390x772  390x844  412x915  430x932  768x1024
```

375x812 is a 13 mini, 390x844 a 15, 412x915 a Pixel 7, 430x932 a 15 Pro Max,
375x667 an SE, 768x1024 an iPad in portrait.

**The odd ones — 375x740, 390x772, 360x600 — are the point.** A browser window
has no safe-area insets. A real phone loses roughly 50pt to the notch and has a
tab bar ~83pt tall rather than 60, so it has 70–90pt less usable height than its
spec size suggests. Testing 375x812 alone passes while the actual 13 mini
clips. These rows stand in for the device.

390x772 in particular has caught a bug that every other size missed.

## Reading a failure

```
390x772  {"size":"390x772","clipped":[{"text":"stop","overBy":33,"container":"406-611"}],...}
```

`overBy` is how many points of the element fall outside the box that hides it.
Screenshot that size before changing anything — the fix depends on whether the
container is too small or the contents too large:

```bash
sed 's/--window-size=430,900/--window-size=390,772/' \
  .claude/skills/run-wanawun/driver.mjs > /tmp/d.mjs
node /tmp/d.mjs goto /flashcards tap "Reveal answer" shot 390x772.png
```

Then open the PNG. A number says something is wrong; only the picture says what.

## The three causes, all of which have happened here

**A breakpoint keyed to the window when it should key to the element.** The
flashcard sized its type from `useWindowDimensions().height`, but the window
doesn't know whether the explanation panel above the card is open. Between 760
and 820pt the card used full-size type in a box too small for it. Measure the
box with `onLayout` and key to that instead.

**Safe-area insets counted more than once.** `useBottomTabBarHeight()` already
includes `insets.bottom`, and `<SafeAreaView edges={['bottom']}>` adds it again.
Flashcards had all three at once and lost ~70pt at the bottom of the screen.
Other tabs take `edges={['top']}` and pad with `tabBarHeight` alone — match them.

**A fixed height where a flex item belongs.** A height computed by subtracting
guessed chrome from the window is wrong on every screen it wasn't tuned on, and
when the guess is low the content overflows its container rather than shrinking.
Prefer `flex: 1` with `minHeight: 0` and a `maxHeight` ceiling, so the space
decides the size and the number only stops it sprawling on a tablet.

## Gotchas

- **A passing sweep is not a good-looking screen.** The probe finds overflow, not
  ugliness. A card squeezed to 220pt passes and can still look wrong — open a
  screenshot at the smallest passing size.
- **Each size is a fresh browser launch**, so the full sweep takes a few minutes.
  Use `SIZES=` while iterating and run the sweep before you commit.
- **State persists between sizes** — same profile, so a panel dismissed at one
  size stays dismissed at the next. Clear it if that matters:
  `eval "localStorage.removeItem('flashcardsIntroDismissed')"`.
- **Tablet is a ceiling check, not a layout check.** 768x1024 is there to catch
  something sprawling, not to say the screen is designed for a tablet.
