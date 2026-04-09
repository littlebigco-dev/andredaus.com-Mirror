# andredaus.com — Project Brief for Claude Code

## Project Overview
Full Astro site for andredaus.com — no WordPress, no PHP.
Strategic Opposition consulting brand for André Daus.
Slogan: "The problem is rarely the problem."

---

## Stack
- Astro with Cloudflare Pages adapter
- No UI framework — pure Astro components, vanilla JS only
- Pagefind for Library search
- PostHog analytics (EU endpoint: eu.i.posthog.com)
- Deployed to Cloudflare Pages via GitLab CI

---

## Design System
- Background: `#090c14` (dark navy)
- Accent: `#c49a3c` (gold)
- Text: `#e8e3d8` (off-white)
- Heading font: Instrument Serif
- Body font: Work Sans
- Code/accent font: DM Mono
- CSS methodology: BEM
- No Tailwind, no CSS frameworks
- All design tokens in `src/styles/global.css`
- Scoped styles in components where needed

---

## i18n
- EN is default language — no path prefix
- DE is second language — `/de/` prefix
- Path segments stay in EN for now (localised slugs later)
- Examples:
  - `andredaus.com/insights/post-slug` (EN)
  - `andredaus.com/de/insights/post-slug` (DE)
- Content folder structure mirrors language:
  - `src/content/insights/en/`
  - `src/content/insights/de/`

---

## Content Collections

### Insights
Articles on Strategic Opposition methodology, business psychology, technology.
```yaml
title: string
date: date
slug: string
og_title: string        # shorter title for OG image generation
summary: string         # AI-generated at build time
category: string        # Strategy | Psychology | Technology | Business | Methodology
status: draft | published
```

### Services
Consulting services — occasionally added or retired.
```yaml
title: string
slug: string
status: active | retired
price: string           # e.g. "€400" or "from €400"
format: string          # e.g. "90 min video call"
cta_label: string
featured_use_cases: reference(use-cases)[]
```

### Use Cases
PAS-framework articles showing how services solve real-world problems.
```yaml
title: string
date: date
slug: string
og_title: string
summary: string
status: draft | published
category: string        # Strategy | Leadership | Operations | Communication | Decision Making
related_service: reference(services)
related_library: reference(library)[]
```

### Library
Evergreen reference entries — cognitive biases, liberating structures, mental models.
```yaml
title: string
slug: string
category: bias | liberating-structure | mental-model
og_title: string
summary: string
last_updated: date
related_concepts: reference(library)[]    # cross-category library entries
related_entries: reference(library)[]     # same-category library entries
related_use_cases: reference(use-cases)[]
```

### FAQs
```yaml
question: string
answer: string
category: string        # Services | Methodology | Working Together | Technical
order: number
```

### Podcast
Manual entries with full transcript as Markdown body content.
```yaml
title: string
date: date
slug: string
episode_number: number
summary: string
og_title: string
spotify_url: string
youtube_url: string     # optional — recent episodes only
category: string        # Solo Episode | Interview | Case Study
status: draft | published
```
Transcript = Markdown body (below frontmatter divider).

---

## Collection Relationships
- Use Cases → Library via `reference(library)[]`
- Use Cases → Services via `reference(services)` (single)
- Library → Use Cases via `reference(use-cases)[]`
- Library → Library (cross-category) via `reference(library)[]`
- Library → Library (same-category) via `reference(library)[]`
- Services → Use Cases via `reference(use-cases)[]`

### Relationship Logic
- Library entries do NOT carry service CTAs directly
- Use Cases carry one service CTA (the most relevant service)
- The content chain is: Library → Use Case → Service
- Services link to manually curated featured Use Cases only

---

## Static Pages
- Home
- About / Methodology
- Contact
- 404
- Policies (index page + individual policy pages — Privacy Policy, Impressum, others)

---

## External Integrations

### OG Image Generation
- Cloudflare Worker receives og_title, returns image URL
- Called at build time for any entry missing an OG image
- Result written back into frontmatter

### Contact Form
- Astro API endpoint in `src/pages/api/contact.ts`
- Posts to Cloudflare Pages Function
- Forwards data to Zoho CRM

### Booking
- Cal.com — Clarity Session event type
- Integrated natively in relevant pages
- No iframe — native Astro component using Cal.com API

### Analytics
- PostHog in base layout `src/layouts/Base.astro`
- EU endpoint: `eu.i.posthog.com`
- Loaded via inline snippet in `Base.astro` (async, fetches from PostHog CDN)
- `posthog-js` npm package is installed for custom event tracking in client scripts

---

## Project Structure
```
src/
  content.config.ts # Content collection schemas (Astro 6 location)
  components/       # Reusable Astro components (Header, Footer, Nav, etc.)
  layouts/          # Page layouts (Base.astro, etc.)
  pages/            # All routes including static pages and API endpoints
  styles/           # global.css with all design tokens and BEM components
  content/          # All content collections
    insights/
      en/
      de/
    services/
      en/
      de/
    use-cases/
      en/
      de/
    library/
      en/
      de/
    faqs/
      en/
      de/
    podcast/
      en/
      de/
public/
  fonts/            # Self-hosted .woff2 font files (Instrument Serif, Work Sans, DM Mono)
```

---

## Library Archive Page (Complex)
The Library archive is the most complex page on the site. It requires:
- Category filter (bias / liberating-structure / mental-model)
- Full-text search via Pagefind
- Alphabetical index showing only letters that have entries
- All filtering runs client-side on static data — no server required

---

## Conventions
- One global CSS file for design tokens and base styles
- Scoped `<style>` blocks in `.astro` components for component-specific styles
- BEM naming throughout
- No Tailwind, no CSS frameworks, no UI frameworks
- Vanilla JS for interactivity unless a specific problem requires otherwise
- All content in Markdown with YAML frontmatter
- Categories defined as `string` initially — tighten to enum once content stabilises
- `reference()` for all cross-collection relationships — never manual slug strings

### Global utility classes (defined in global.css — usable everywhere)
- `.container` — max-width wrapper with gutter padding
- `.section` — vertical section padding
- `.label` — gold mono label with decorative line prefix
- `.btn`, `.btn--primary`, `.btn--outline`, `.btn-arrow` — button variants
- `.skip-link` — WCAG 2.4.1 skip-to-content link
- `.sr-only` — screen-reader-only visually hidden text
- `.img-ph`, `.img-ph__icon`, `.img-ph__label`, `.img-ph__desc` — image placeholder
- `.prose` — max-width constraint for body text

---

## Technical Decisions (recorded during build)

### Astro version
- Astro 6 — uses new content layer API (not legacy content collections)
- Content config lives at `src/content.config.ts` (NOT `src/content/config.ts`)
- Collections use `glob` loader from `astro/loaders`

### Output mode
- `output: 'static'` — site is fully static
- When the contact form API route is added (Phase 5), add `export const prerender = false` to `src/pages/api/contact.ts`; the static adapter handles this via Cloudflare Pages Functions

### PostHog
- Loaded via inline script in `Base.astro` — only renders when `PUBLIC_POSTHOG_KEY` env var is set
- EU endpoint: `https://eu.i.posthog.com`
- Set key in `.env` locally (see `.env.example`); add to Cloudflare Pages env vars for production

### Fonts
- Self-hosted in `public/fonts/` as `.woff2` files, declared via `@font-face` in `global.css`
- Work Sans: weights 300/400/500/600/700 (+ italics); Instrument Serif: 400 regular + italic; DM Mono: 300/400/500 (+ italics)
- Google Fonts links removed — no external font requests

### Design token naming
- CSS variable names follow the reference HTML convention: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--bg-card`, `--gold`, `--gold-light`, `--gold-dim`, `--gold-glow`, `--gold-trans`, `--text-primary`, `--text-secondary`, `--text-subtle`, `--text-muted`, `--border`, `--border-light`, `--serif`, `--sans`, `--mono`
- Layout shorthand tokens: `--max-w: 1160px`, `--gutter: clamp(1.25rem,4vw,2.5rem)`, `--section: clamp(5rem,10vw,9rem)`
- Old Phase 1 names (`--color-bg`, `--color-accent`, `--font-heading`, etc.) have been replaced — do not use them

### Component architecture
- `Header.astro` — thin wrapper: skip link + `<Nav />`
- `Nav.astro` — full navigation bar + mobile drawer + JS; self-contained
- `Footer.astro` — footer with brand, nav columns, social links, legal bar
- `Base.astro` — imports Header and Footer, wraps `<slot />` in `<main id="main-content">`
- Nav path prefix is derived from `Astro.url.pathname`; isDE = pathname starts with `/de`
- Nav route paths: `/services`, `/use-cases`, `/insights`, `/podcast`, `/about`, `/contact`
- The reference HTML uses `/opposition` for the methodology page — Phase 3 should decide whether this becomes `/about` (combined About + Methodology) or two separate pages (`/about` and `/opposition`), then update the nav links accordingly

### Content collection IDs
- Because `glob` loader is used with `base: ./src/content/<collection>`, the `id` of each entry will be `en/slug.md` or `de/slug.md`
- Filter by language in page templates: `entries.filter(e => e.id.startsWith('en/'))`

---

## Build Phases
Work through these in order, one Claude Code session per phase:

1. ~~**Foundation**~~ ✅ — Astro scaffold, Cloudflare adapter, i18n config, collection schemas, design system CSS, base layout with PostHog
2. ~~**Components**~~ ✅ — Fonts self-hosted, global.css design tokens expanded, Header/Nav/Footer components built, Base.astro wired up
3. **Static pages** — Home, About, Contact, 404, Policies
4. **Collection templates** — Single page templates per collection, archive/listing pages, Library archive with filters
5. **Integrations** — Contact form Worker, OG image hook, Cal.com booking, Pagefind
6. **Pipeline** — GitLab CI, Cloudflare Pages deployment, RSS podcast import, AI summary generation

End each session by asking Claude Code to:
1. Update this CLAUDE.md with any new decisions or conventions
2. Summarise what was completed and what the next session should start with
