---
source: [Site Name]
url: https://example.com
extracted: [YYYY-MM-DD]
extracted_via: browser inspection (computed styles) / Firecrawl branding / mixed
---

# [Site Name] — Design Blueprint

## Overview
[2-3 sentences: overall mood, light/dark, density (airy vs. dense), personality (technical/editorial/playful/premium), what makes it visually distinctive.]

## Color Palette
| Role | Hex | Source (rgb as computed) | Usage |
|---|---|---|---|
| Background | `#______` | | Page/app background |
| Surface | `#______` | | Cards, panels, elevated containers |
| Primary text | `#______` | | Body copy, headings |
| Secondary text | `#______` | | Captions, muted labels |
| Accent | `#______` | | Links, primary CTA, focus states — one accent, used sparingly |
| Border | `#______` | | Dividers, input borders, card outlines |
| Success / Error / Warning | `#______` / `#______` / `#______` | | Status colors, if present |

**Color scheme:** light / dark / both (toggle detected)
**Accent rule observed:** [does the site actually restrict itself to one accent, or use several? note reality, not aspiration]

## Typography
| Role | Font Family (as rendered) | Weight | Size | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | | | | | |
| H2 | | | | | |
| H3 | | | | | |
| Body | | | | | |
| Caption / small | | | | | |
| Button / label | | | | | |

**Font source:** [Google Fonts / Fontshare / self-hosted woff2 / system stack] — confirmed via `document.fonts`
**Fallback stack observed:** [the full computed `font-family` value, commas and all]

## Spacing Scale
**Base unit:** __px
**Steps observed:** [e.g. 8 / 16 / 24 / 32 / 48 / 64 — only list values actually seen, not a generic scale]

## Shape & Elevation
| Element | Border Radius | Shadow | Border |
|---|---|---|---|
| Button | | | |
| Card | | | |
| Input | | | |
| Modal / overlay | | | |

## Component Anatomy
### Buttons
- **Primary:** [background, text color, radius, padding, hover/focus behavior if observed]
- **Secondary / ghost:** [same, if a visually distinct second style exists]

### Inputs
- [background, border, radius, focus ring treatment, placeholder color vs. filled text color]

### Cards / panels
- [background vs. page background, border vs. shadow for separation, radius, internal padding]

### Navigation
- [layout — top bar / sidebar, background, active-state treatment, mobile pattern (hamburger / bottom bar / none)]

## Responsive Behavior
| Breakpoint | Width | What changes |
|---|---|---|
| Mobile | ~375px | |
| Tablet | ~768px | |
| Desktop | ~1024px+ | |

## Iconography & Imagery
- **Icon style:** [line / filled / duotone], stroke weight [thin/medium/bold], likely source: [e.g. Lucide, Heroicons, custom]
- **Imagery:** [photography / illustration / none / abstract], treatment notes

## Reference Screenshots
- Desktop: [path or description]
- Mobile: [path or description]

## Quick Reference (CSS custom properties)
```css
:root {
  --color-bg: #______;
  --color-surface: #______;
  --color-fg: #______;
  --color-fg-muted: #______;
  --color-accent: #______;
  --color-border: #______;

  --font-display: [family, fallback stack];
  --font-body: [family, fallback stack];

  --radius-sm: __px;
  --radius-md: __px;
  --radius-lg: __px;

  --shadow-sm: [value];
  --shadow-md: [value];

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
}
```

---

## Reference
**Source URL:** [https://_____.___](https://_____.___)
