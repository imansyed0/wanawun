// Generic layout probe. Returns the things that actually break on small screens,
// none of which are visible in a 430x900 browser window.
//
// Read back as JSON by check.sh; safe to paste into `driver.mjs eval` directly.
(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const all = Array.from(document.querySelectorAll('*'));
  const box = (e) => e.getBoundingClientRect();
  const onScreen = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;

  // 1. Content sliced off by an ancestor that hides its overflow. This is what a
  //    card looks like when its contents no longer fit inside it.
  // Only something that declares itself scrollable. Deliberately NOT
  // scrollHeight > clientHeight: content spilling past a box that hides its
  // overflow is the exact bug being looked for, and that test hides it.
  const scrolls = (e) => {
    const st = getComputedStyle(e);
    return ['auto', 'scroll', 'overlay'].includes(st.overflowY);
  };

  const clipped = [];
  for (const el of all) {
    const s = getComputedStyle(el);
    if (s.overflow !== 'hidden' && s.overflowY !== 'hidden') continue;
    const pr = box(el);
    if (!onScreen(pr) || pr.height < 40) continue;
    // The page itself, and anything as tall as it, clips by definition.
    if (pr.height >= vh - 4) continue;
    for (const child of el.querySelectorAll('*')) {
      if (child.children.length) continue;
      const cr = box(child);
      if (cr.height === 0 || !child.textContent.trim()) continue;
      const over = Math.round(Math.max(cr.bottom - pr.bottom, pr.top - cr.top));
      if (over <= 1) continue;
      // A list is meant to run past its own edge: that is scrolling, not
      // breakage. Only flag content cut off by something that cannot scroll.
      let scrollable = false;
      for (let n = child.parentElement; n && n !== el; n = n.parentElement) {
        if (scrolls(n)) { scrollable = true; break; }
      }
      if (scrollable || scrolls(el)) continue;
      {
        clipped.push({
          text: child.textContent.trim().slice(0, 24),
          overBy: over,
          container: Math.round(pr.top) + '-' + Math.round(pr.bottom),
        });
      }
    }
  }

  // 2. Anything sitting under the tab bar, which paints over it.
  const tab = all.find((e) => {
    const t = e.textContent.trim();
    const r = box(e);
    return /^Glossary/.test(t) && /Profile$/.test(t) && r.height < 90 && r.height > 30;
  });
  const tabTop = tab ? Math.round(box(tab).top) : null;
  const underTab = [];
  if (tabTop != null) {
    for (const el of all) {
      if (el.children.length || !el.textContent.trim()) continue;
      const r = box(el);
      if (onScreen(r) && r.top < vh && r.bottom > tabTop + 2 && el !== tab && !tab.contains(el)) {
        underTab.push(el.textContent.trim().slice(0, 24));
      }
    }
  }

  // 3. Sideways scroll: always a bug on a phone.
  const wide = Math.round(document.documentElement.scrollWidth - vw);

  return {
    size: vw + 'x' + vh,
    clipped: clipped.slice(0, 6),
    underTabBar: [...new Set(underTab)].slice(0, 6),
    horizontalOverflow: wide > 1 ? wide : 0,
    ok: clipped.length === 0 && underTab.length === 0 && wide <= 1,
  };
})()
