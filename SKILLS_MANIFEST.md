# Skills Manifest & Installation Guide

This file documents all design/UI skills uploaded and how to organize them in the `.claude/skills` directory for use with Claude Code.

## Skills to Install

You've uploaded 7 design/UI-related skills. Below is the proper installation structure.

---

## 1. UI Styling (`ui-styling`)

**Filename:** `SKILL.md` → Save as `.claude/skills/ui-styling/SKILL.md`

**Purpose:** Build beautiful, accessible UIs with shadcn/ui + Tailwind CSS

**When to use:**
- Creating React/Next.js components
- Building responsive layouts
- Implementing accessible form elements
- Applying utility-first styling
- Dark mode implementation
- Component library integration

**Key features:**
- shadcn/ui components (Button, Card, Dialog, Form, Input, Select, etc.)
- Tailwind CSS utilities and responsive design
- Design tokens and theming
- Accessibility patterns (ARIA, keyboard navigation)
- Common patterns (forms, tables, layouts)

**Usage in Claude Code:**
```
Use the `/ui-styling` skill to:
- Build a responsive dashboard with shadcn/ui Card components
- Implement dark mode toggle with Tailwind CSS
- Create accessible form for jump video upload
```

---

## 2. Design (`design`)

**Filename:** `SKILL.md` → Save as `.claude/skills/design/SKILL.md`

**Purpose:** Comprehensive design system — brand identity, logos, banners, CIP, slides, social media

**When to use:**
- Creating logos and brand identity
- Designing banners for social media, ads, web
- Generating corporate identity packages (CIP)
- Creating presentation decks
- Designing social media graphics
- Establishing visual design systems

**Key sub-skills:**
- **Logo Design** — 55+ styles, Gemini AI generation
- **CIP (Corporate Identity Program)** — 50+ deliverables
- **Banners** — 22 art styles for multiple platforms
- **Slides** — Strategic HTML presentations with Chart.js
- **Social Photos** — Multi-platform image design
- **Icons** — SVG icon generation

**Usage in Claude Code:**
```
Use the `/design` skill to:
- Create a modern logo for the Whoop Jump Trainer feature
- Design social media graphics (1080x1080 Instagram post)
- Generate banner assets for web promotion
```

---

## 3. Power Design (`power-design`)

**Filename:** `SKILL.md` → Save as `.claude/skills/power-design/SKILL.md`

**Purpose:** Brand-native HTML generation for presentations and responsive websites

**When to use:**
- Generating entire presentation decks in a brand's design language
- Building responsive marketing websites
- Creating brand-compliant slide decks
- Generating beautiful one-page sites
- Building multi-page websites with brand consistency

**Key features:**
- Extracts brand DNA from URLs (via Firecrawl or manual)
- 20 design principles for slides (fixed 16:9 frames)
- 20 design principles for responsive web
- Semantic HTML5 output
- Dark mode theming
- Design tokens integration

**Usage in Claude Code:**
```
Use the `/power-design` skill to:
- Create a landing page for the Jump Trainer feature
- Generate a pitch deck for the Whoop integration
- Build a marketing site with brand-native design
```

---

## 4. Design System (`design-system`)

**Filename:** `SKILL.md` → Save as `.claude/skills/design-system/SKILL.md`

**Purpose:** Token architecture, component specs, systematic design, slide generation

**When to use:**
- Creating design token systems (3-layer: primitive → semantic → component)
- Establishing component specifications
- Building CSS custom-property systems
- Configuring Tailwind theme
- Creating design-to-code handoffs
- Generating strategic presentations

**Key features:**
- Three-layer token architecture
- Component state definitions
- Spacing and typography scales
- CSS variable systems
- Tailwind integration
- Contextual slide generation
- Decision system CSVs for automated slide creation

**Usage in Claude Code:**
```
Use the `/design-system` skill to:
- Define color tokens (primary, secondary, accent)
- Create spacing scale (8pt base unit)
- Build component specs for buttons, cards, forms
```

---

## 5. Brand (`brand`)

**Filename:** `SKILL.md` → Save as `.claude/skills/brand/SKILL.md`

**Purpose:** Brand voice, visual identity, messaging frameworks, asset management

**When to use:**
- Defining brand voice and tone
- Creating visual identity guidelines
- Establishing messaging frameworks
- Managing brand consistency
- Organizing brand assets
- Reviewing brand compliance

**Key features:**
- Brand voice and communication tone
- Visual identity standards
- Messaging frameworks
- Asset management and organization
- Color palette management
- Typography specifications
- Logo usage rules
- Brand consistency checklists

**Usage in Claude Code:**
```
Use the `/brand` skill to:
- Define the brand voice for Whoop Jump Trainer
- Establish visual identity standards
- Create messaging framework for marketing
```

---

## 6. Design Extraction (`design-extraction`)

**Filename:** `SKILL.md` → Save as `.claude/skills/design-extraction/SKILL.md`

**Purpose:** Reverse-engineer design systems from live URLs (extract real, rendered values)

**When to use:**
- Cloning or matching a website's design
- Extracting actual computed style values
- Building design blueprints from reference sites
- Documenting existing design systems
- Learning from competitor sites

**Key features:**
- Extracts real rendered colors, fonts, spacing
- Computed styles (not guesses from source code)
- Breakpoint detection
- Component anatomy documentation
- CSS custom-properties generation
- No paid dependencies required

**Usage in Claude Code:**
```
Use the `/design-extraction` skill to:
- Extract design system from Whoop's existing website
- Create a design blueprint from a reference fitness app
- Match styling from a competitor's UI
```

---

## 7. Banner Design (`banner-design`)

**Filename:** `SKILL.md` → Save as `.claude/skills/banner-design/SKILL.md`

**Purpose:** Multi-format banner design for social media, ads, websites, print

**When to use:**
- Creating social media banners (Facebook, Twitter, LinkedIn, Instagram)
- Designing ad banners (Google Ads formats)
- Building website hero sections
- Creating print banners
- Generating marketing assets

**Key features:**
- Multiple format support (social, ads, web, print)
- 22 art direction styles
- Exact platform dimensions
- Multi-option generation
- AI-powered visual generation
- Typography and spacing rules
- Safe zone compliance

**Usage in Claude Code:**
```
Use the `/banner-design` skill to:
- Create Twitter/X header banner (1500x500) for Jump Trainer
- Design Instagram story graphics (1080x1920)
- Generate Facebook cover image (820x312)
```

---

## Installation Instructions

### Step 1: Create Directory Structure

```bash
mkdir -p .claude/skills/{ui-styling,design,power-design,design-system,brand,design-extraction,banner-design}
```

### Step 2: Copy SKILL.md Files

For each skill, copy the uploaded `SKILL.md` file to its corresponding directory:

```bash
# Example: Copy ui-styling SKILL.md
cp /path/to/uploaded/ui-styling-SKILL.md .claude/skills/ui-styling/SKILL.md

# Repeat for all skills:
# - design/SKILL.md
# - power-design/SKILL.md
# - design-system/SKILL.md
# - brand/SKILL.md
# - design-extraction/SKILL.md
# - banner-design/SKILL.md
```

### Step 3: Optional — Create Reference Directories

Each skill may include reference materials, templates, or scripts. If uploading those:

```bash
.claude/skills/[skill-name]/
├── SKILL.md               # Required
├── references/            # Optional
│   ├── guide-1.md
│   └── guide-2.md
├── scripts/               # Optional
│   └── helper.py
└── assets/                # Optional
    └── template.html
```

### Step 4: Verify Installation

List installed skills:

```bash
find .claude/skills -name 'SKILL.md' | sort
```

Expected output:
```
.claude/skills/banner-design/SKILL.md
.claude/skills/brand/SKILL.md
.claude/skills/design/SKILL.md
.claude/skills/design-extraction/SKILL.md
.claude/skills/design-system/SKILL.md
.claude/skills/power-design/SKILL.md
.claude/skills/ui-styling/SKILL.md
```

---

## How to Use Skills in Claude Code

### Direct Invocation

Reference the skill by name when asking Claude Code for design/UI work:

```
Use the `/ui-styling` skill to build the dashboard components with shadcn/ui.
```

### Cross-Skill References

Skills often reference each other. For example, `/power-design` may reference `/brand` and `/design-system`. Claude Code will chain these automatically when needed.

### Common Workflows

**Workflow 1: Build a Responsive Dashboard**
```
1. Use `/design-system` skill → define tokens (colors, spacing, type)
2. Use `/ui-styling` skill → build components with shadcn/ui + Tailwind
3. Use `/brand` skill → ensure visual consistency
```

**Workflow 2: Generate a Marketing Website**
```
1. Use `/brand` skill → extract brand context
2. Use `/power-design` skill → generate responsive HTML
3. Use `/design-extraction` skill → fine-tune with reference styles
```

**Workflow 3: Create Marketing Banners**
```
1. Use `/banner-design` skill → specify platform (Instagram, Facebook, etc.)
2. Use `/design` skill → generate visual assets
3. Use `/design-system` skill → apply brand tokens
```

---

## Skills Quick Reference Matrix

| Skill | UI Components | Styling | Brand | Responsive | Figma→Code | Assets |
|-------|---------------|---------|-------|------------|-----------|--------|
| ui-styling | ✅ | ✅ | – | ✅ | – | – |
| design | – | – | ✅ | – | – | ✅ |
| power-design | – | ✅ | ✅ | ✅ | – | ✅ |
| design-system | – | ✅ | ✅ | ✅ | – | – |
| brand | – | – | ✅ | – | – | ✅ |
| design-extraction | – | ✅ | ✅ | ✅ | ✅ | – |
| banner-design | – | ✅ | ✅ | – | – | ✅ |

---

## Next Steps

1. **Set up skills directory** using Step 1-2 above
2. **Copy all SKILL.md files** to their respective directories
3. **Verify installation** using the find command in Step 4
4. **Start Phase 1** — Feed `CLAUDE_CODE_KICKSTART.md` into Claude Code
5. **Reference skills** in your prompts as needed (e.g., "Use `/ui-styling` skill to...")

---

## Project-Specific Skill Usage

For the **Whoop Jump Training Platform**, you'll primarily use:

- **`/ui-styling`** — Build dashboard components, jump trainer UI, forms
- **`/design-system`** — Define tokens for Whoop brand colors/spacing/typography
- **`/brand`** — Maintain consistency with Whoop visual identity
- **`/power-design`** — Generate marketing website or landing page
- **`/design-extraction`** — Extract reference from Whoop's existing site
- **`/banner-design`** — Create social/marketing banners (optional)

Start with `/ui-styling` and `/design-system` for the core product UI.

---

## Troubleshooting

**Q: Skill not recognized in Claude Code**
- Verify SKILL.md is in `.claude/skills/[skill-name]/SKILL.md`
- Check file path has no typos
- Try referencing skill as `/skill-name` in prompt

**Q: Can't find references or scripts within a skill**
- Skill might reference external files not included in SKILL.md
- Create placeholder directories in the skill folder
- Reference docs often need manual setup

**Q: Conflicting advice from different skills**
- Use primary skill most relevant to task
- Skills are composable; cross-reference when needed
- Later advice in conversation overrides earlier

---

## Support

For detailed skill documentation, see each skill's SKILL.md file directly. Each contains:
- `references/` section — links to in-skill docs
- `when-to-use` section — scenarios and triggers
- `workflow` section — step-by-step patterns
- `examples` section — real usage patterns
