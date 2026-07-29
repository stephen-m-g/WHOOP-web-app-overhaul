---
name: design-extraction
description: "Extracts a website's real, rendered design system — exact colors, type scale, spacing, border-radius, shadows, button/input/card anatomy, breakpoints, and iconography style — into one implementation-ready markdown blueprint with a CSS custom-properties block at the end. Use this whenever a user gives a URL and wants to clone, match, reference, or reverse-engineer a site's look: \"extract the design system from this site\", \"clone the styling of stripe.com\", \"build a design blueprint from this URL\", \"match the look of this website\", \"what fonts/colors does X use\", or \"give me a starting point that looks like Y so I can build off it\". Works standalone with no paid API — inspects the live, rendered page (computed styles, not guesses from source HTML)."
argument-hint: "[url] [output path (optional)]"
license: MIT
metadata:
  author: claudekit
  requires: Browser MCP tools (or WebFetch as a fallback), no external API required
---

# Design Extraction — reverse-engineer a site's real design system

Turn any live URL into one markdown file someone can build a UI from — exact hex values, a real type scale, a real spacing scale, component anatomy, and a CSS custom-properties block, all measured from the rendered page rather than guessed.

This is a sibling to the `power-design` skill installed in this project, but the two solve different problems:
- **power-design** (`lib/extract-brand.md`) extracts **brand voice** — mood, personality, marketing tone — via the paid Firecrawl API, to feed slide/website *generation*.
- **design-extraction** (this skill) extracts the **implementation** — the actual CSS values a browser computes — with zero paid dependencies, for *reference and reuse*.

If Firecrawl is already configured in this project (check for `FIRECRAWL_API_KEY`), you can use its `branding` format as a faster first pass — see `power-design/lib/extract-brand.md` for that recipe — then layer this skill's computed-style inspection on top to fill in anything Firecrawl missed (exact spacing scale, shadows, breakpoints). But never block on Firecrawl being available: the primary path below needs nothing but the Browser tool.

## The core idea

Don't parse source CSS and guess — **measure the rendered page**. `getComputedStyle()` on real elements gives you the actual resolved font sizes, colors, radii, and shadows after all cascade/media-query/framework logic has already run. This is more reliable than reading a minified stylesheet and is what makes this workflow dependency-free.

## Workflow

1. **Open the site.** Navigate the Browser tool to the URL. Prefer a marketing/home page over a logged-in app view — it carries more of the design system's "greatest hits" (hero type, primary buttons, cards) in one screen.
2. **Screenshot at 2-3 viewport widths.** Desktop (1440 or 1280) and mobile (375) at minimum; add tablet (768) if the site clearly changes layout there. Screenshots anchor the write-up and catch things computed-style queries miss (imagery treatment, overall density, logo lockup).
3. **Run the extraction scripts** via the browser's JS execution tool against `document` — one pass each for typography, color palette, spacing/shape, and CSS custom properties already defined by the site. Ready-to-run snippets are in `references/extraction-workflow.md` — don't reinvent these, they handle edge cases (transparent colors, cross-origin stylesheets, missing elements) that naive versions miss.
4. **Detect breakpoints.** Resize the viewport through common widths (375/768/1024/1440) and note where layout shifts (nav collapses to a hamburger, grid columns change, type scale steps down). `references/extraction-workflow.md` has the resize-and-diff approach.
5. **Note iconography and imagery style** from the screenshots: line vs. filled icons, stroke weight, corner treatment on photos/illustrations, illustration vs. photography vs. none.
6. **Synthesize into one blueprint file** using `assets/blueprint-template.md` as the schema. Fill in every table with real measured values — never placeholder text in the final output. If something genuinely can't be determined (e.g., a shadow that's actually a border), say so rather than inventing a number.
7. **Save and confirm.** Default output path: `design-blueprints/<site-slug>-blueprint.md` in the current project (create the folder if needed). Tell the user where it went and offer to open the reference screenshots alongside it.

## What makes a good blueprint

- **Every color has a real hex value**, not "blue" or "brand primary" — pull it straight from a computed `rgb()`/`rgba()` and convert to hex.
- **Type sizes are in px as computed**, with the font-family stack exactly as `font-family` resolves it (so fallback fonts are visible too).
- **The spacing scale is inferred from evidence** — look at padding/margin/gap values across several elements and find the common base unit (usually 4 or 8px) rather than listing every raw number seen.
- **Component anatomy describes states where visible** — hover/focus/disabled — not just the resting state, if you can trigger them (e.g., `:hover` via the browser tool's hover action, or reading `:focus-visible` rules from stylesheet text).
- **The closing CSS block is copy-paste usable** — a `:root { }` block with the same variable naming convention as `power-design`'s brand files (`--color-bg`, `--color-fg`, `--color-accent`, `--radius`, etc.) so output from either skill can sit side by side.

## Common pitfalls

- **Don't trust `<meta>` theme-color or favicon dominant color as "the brand color."** Sample actual button/link/heading colors instead — theme-color is often just a browser-chrome tint.
- **Cross-origin stylesheets throw when read via `document.styleSheets`.** The extraction script in `references/extraction-workflow.md` wraps this in a try/catch and falls back to computed styles, which always work regardless of stylesheet origin.
- **Google Fonts / Fontshare fonts show up in `document.fonts`** — check there for the exact family + weight list actually loaded, rather than assuming from the CSS `font-family` name alone (a site can declare a font it never successfully loads).
- **Don't average colors across the whole page** — rank by frequency and pick the top few *meaningfully distinct* ones. A page can have hundreds of computed color values that are all near-duplicates of the same 5-6 real colors (anti-aliasing, slightly-transparent overlays, etc.).

## Files in this skill

- `references/extraction-workflow.md` — the concrete step-by-step with ready-to-run browser JS snippets for typography, palette, spacing/shape, CSS custom properties, and breakpoint detection.
- `assets/blueprint-template.md` — the output schema. Copy it, fill in every field with measured values, delete the instructional comments.
