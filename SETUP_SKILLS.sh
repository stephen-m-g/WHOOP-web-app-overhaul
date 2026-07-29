#!/bin/bash

# Setup Script: Initialize .claude/skills directory with SKILL.md files
# Run this script from the project root directory

echo "🚀 Initializing .claude/skills directory..."

# Create directory structure
mkdir -p .claude/skills/{banner-design,brand,design,design-extraction,design-system,power-design,ui-styling}

# Note: Copy your uploaded SKILL.md files to these locations
# Each skill folder should contain: SKILL.md + any associated reference files

# For now, we'll create placeholder instructions
cat > .claude/SKILLS_README.md << 'EOF'
# Skills Directory Setup

This directory contains reusable Claude skills for design, UI, and branding tasks.

## Skills Included

### ui-styling
- **Purpose:** Build beautiful, accessible UIs with shadcn/ui + Tailwind CSS
- **Use:** When creating React/Next.js components, styling, responsive layouts
- **Location:** `.claude/skills/ui-styling/SKILL.md`

### design
- **Purpose:** Comprehensive design: brand identity, logos, banners, social media
- **Use:** When designing logos, banners, corporate identity packages
- **Location:** `.claude/skills/design/SKILL.md`

### power-design
- **Purpose:** Brand-native HTML generation (slides + responsive websites)
- **Use:** When generating entire presentations or websites in a brand's design language
- **Location:** `.claude/skills/power-design/SKILL.md`

### design-system
- **Purpose:** Token architecture, component specifications, slide generation
- **Use:** When creating design tokens, building component specs, creating strategic presentations
- **Location:** `.claude/skills/design-system/SKILL.md`

### brand
- **Purpose:** Brand voice, visual identity, messaging, asset management
- **Use:** When establishing or maintaining brand guidelines
- **Location:** `.claude/skills/brand/SKILL.md`

### design-extraction
- **Purpose:** Reverse-engineer design systems from live URLs
- **Use:** When you want to clone or match a website's design
- **Location:** `.claude/skills/design-extraction/SKILL.md`

### banner-design
- **Purpose:** Multi-format banner design for social, ads, web, print
- **Use:** When creating banners for specific platforms/dimensions
- **Location:** `.claude/skills/banner-design/SKILL.md`

## How to Use Skills in Claude Code

When invoking Claude Code with tasks related to UI, design, or branding:

1. **Mention the skill by name** in your prompt (e.g., "Use the `/ui-styling` skill")
2. **Reference specific sections** (e.g., "use shadcn/ui components")
3. **Ask for component specs** (e.g., "generate button styles with Tailwind")

## Setup Instructions

1. Copy each uploaded `SKILL.md` file to the appropriate skill folder
2. Place any reference materials, templates, or scripts in their respective skill folders
3. Ensure the following structure for each skill:

```
.claude/skills/[skill-name]/
├── SKILL.md               # Main skill definition
├── references/            # Reference docs (optional)
│   ├── example-1.md
│   └── example-2.md
├── scripts/               # Helper scripts (optional)
└── assets/                # Templates, examples (optional)
```

4. Test skill loading by invoking a basic prompt that references the skill

## Example Skill Invocation

In your Claude Code prompt:

```
I want to build the Whoop dashboard UI. Use the `/ui-styling` skill to:
- Build a responsive grid layout with shadcn/ui Card components
- Implement a dark mode toggle
- Use Tailwind CSS for styling
- Reference the design-system skill for token-based colors
```

This will activate the ui-styling skill and relevant referenced skills.
EOF

echo "✅ Directory structure created at .claude/skills/"
echo ""
echo "📋 Next steps:"
echo "1. Copy your uploaded SKILL.md files to the appropriate skill folders"
echo "2. For each skill, also copy any reference files or templates"
echo "3. Run this command to verify setup: find .claude/skills -name 'SKILL.md' | wc -l"
echo ""
echo "📚 Skills to install:"
echo "   - banner-design/SKILL.md"
echo "   - brand/SKILL.md"
echo "   - design/SKILL.md"
echo "   - design-extraction/SKILL.md"
echo "   - design-system/SKILL.md"
echo "   - power-design/SKILL.md"
echo "   - ui-styling/SKILL.md"
echo ""
echo "💡 See .claude/SKILLS_README.md for more details"
