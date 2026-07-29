# Extraction workflow — ready-to-run snippets

All snippets are meant to be run through the browser tool's JS-execution action (evaluate in the page context) after navigating to the target URL. Run them one at a time and read the output before moving to the next — each pass informs what to look for in the next.

Run these against the **home/marketing page** first. If the request is about a specific screen (a dashboard, a checkout flow), navigate there and re-run the relevant passes on top.

---

## 1. Typography pass

Finds the resolved (post-cascade) type styles for each semantic role. Falls back gracefully when an element doesn't exist on the page.

```js
(() => {
  const roles = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    body: 'p',
    small: 'small, .caption, [class*=caption]',
    link: 'a',
    button: 'button, [role=button], .btn, input[type=submit]',
    input: 'input[type=text], input:not([type=hidden]), textarea',
    nav: 'nav a, nav',
  };
  const out = {};
  for (const [role, selector] of Object.entries(roles)) {
    const el = document.querySelector(selector);
    if (!el) { out[role] = null; continue; }
    const cs = getComputedStyle(el);
    out[role] = {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      color: cs.color,
    };
  }
  return JSON.stringify(out, null, 2);
})();
```

Then check which fonts actually loaded (a site can *declare* a font-family it never successfully fetches):

```js
JSON.stringify([...document.fonts].map(f => ({ family: f.family, weight: f.weight, style: f.style, status: f.status })), null, 2);
```

Cross-reference: the family named in `fontFamily` above should appear in this loaded-fonts list. If it doesn't, the page is falling back to the next font in its stack — record the fallback that's actually rendering, not the aspirational one.

---

## 2. Color palette pass

Walks every element, samples `color` / `background-color` / `border-color`, and ranks by frequency — filtering out fully-transparent values so the signal isn't buried in noise.

```js
(() => {
  const counts = {};
  const record = (v) => {
    if (!v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return;
    counts[v] = (counts[v] || 0) + 1;
  };
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    record(cs.color);
    record(cs.backgroundColor);
    record(cs.borderTopColor);
  });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  return JSON.stringify(ranked, null, 2);
})();
```

The top 1-2 entries are almost always background + primary text (they dominate by element count). Look further down the ranked list for the **accent** — it'll have a much lower count than body text/background but still appear dozens of times (on links, primary buttons, focus rings, icons).

Convert every `rgb()`/`rgba()` value you keep to hex for the blueprint — don't leave `rgb(59, 130, 246)` in the final doc.

To specifically target the primary CTA color (often the single most important accent), sample it directly:

```js
(() => {
  const cta = document.querySelector('button, [role=button], .btn-primary, a.button, a.btn');
  if (!cta) return 'no obvious CTA element found';
  const cs = getComputedStyle(cta);
  return JSON.stringify({ background: cs.backgroundColor, text: cs.color, border: cs.borderColor }, null, 2);
})();
```

---

## 3. Spacing & shape pass

Samples padding/margin/gap across a handful of representative elements to find the base spacing unit, plus border-radius and box-shadow per component type.

```js
(() => {
  const pick = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      padding: cs.padding,
      margin: cs.margin,
      gap: cs.gap,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      border: cs.border,
    };
  };
  return JSON.stringify({
    button: pick('button, .btn, [role=button]'),
    card: pick('[class*=card], article, .panel'),
    input: pick('input:not([type=hidden]), textarea'),
    nav: pick('nav'),
    section: pick('section, main > div'),
  }, null, 2);
})();
```

To find the base spacing unit: collect the numeric px values from the padding/margin/gap results above and look for the largest common divisor — most design systems land on 4px or 8px. Don't list every raw number in the blueprint; report the base unit and the multiples you actually observed (e.g., "8px base — seen at 8/16/24/32/48/64").

---

## 4. CSS custom properties already defined by the site

Many sites already ship semantic tokens at `:root` — grabbing these directly is faster and more accurate than re-deriving them, when available.

```js
(() => {
  const vars = {};
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText === ':root' || rule.selectorText === 'html') {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) vars[prop] = rule.style.getPropertyValue(prop).trim();
          }
        }
      }
    } catch (e) {
      // cross-origin stylesheet — can't read cssRules, skip it silently
    }
  }
  return JSON.stringify(vars, null, 2);
})();
```

If this returns a rich set of tokens, prefer them verbatim in the blueprint (they're the site's actual source of truth) and use the computed-style passes above only to fill gaps. If it returns little or nothing (common with CSS-in-JS or Tailwind's JIT output, which doesn't expose custom properties this way), rely fully on the computed-style passes.

---

## 5. Breakpoint detection

Resize the viewport through common widths and note where the layout visibly changes — nav collapsing to a hamburger, grid columns dropping, type stepping down.

Widths to check, in order: **375 → 768 → 1024 → 1440**. Take a screenshot at each. A breakpoint exists between two widths if the screenshots show a structural change (not just reflow/wrapping — an actual column-count or nav-pattern change).

If you want to corroborate with source instead of eyeballing screenshots, fetch the main stylesheet and grep for `@media`:

```js
(() => {
  const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href);
  return JSON.stringify(links, null, 2);
})();
```

Then fetch one of those URLs (WebFetch or a network-request read) and search the response body for `@media (min-width` / `@media (max-width` to pull the exact declared breakpoints, when the stylesheet isn't minified into unreadability.

---

## 6. Iconography and imagery (visual read, not scripted)

From the screenshots taken in step 2, note:
- **Icon style**: line vs. filled vs. duotone, approximate stroke width, corner treatment (sharp vs. rounded terminals).
- **Icon source guess**: distinctive shapes often identify a known set (Lucide, Heroicons, Phosphor, Font Awesome) — useful so the blueprint can point to a free equivalent rather than requiring the original assets.
- **Imagery**: photography vs. illustration vs. none vs. abstract gradients/shapes; if photography, treatment (duotone overlay, grain, crop style); corner radius applied to images.

This step is deliberately manual — it's a judgment call the computed-style scripts can't make.

---

## 7. Assembling the blueprint

Once all passes are done, open `assets/blueprint-template.md`, copy it to the output path, and fill every section with the measured values above. Delete any instructional bracket-text — a finished blueprint should read as a clean reference doc, not a fill-in-the-blanks form.
