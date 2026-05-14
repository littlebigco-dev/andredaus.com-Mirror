---
task: andredaus.com Launch-Readiness Sprint
slug: andredaus-launch-readiness
project: andredaus-com
effort: E4
phase: execute
progress: 0/145
mode: algorithm
started: 2026-05-07T00:00:00Z
updated: 2026-05-07T00:00:00Z
---

## Problem

The andredaus.com Astro site is code-complete and CI/CD-wired, but is not ready for production launch. Six categories of work remain:

1. **SEO infrastructure is absent** — no sitemap, no robots.txt, no JSON-LD structured data, no `og:locale`, no `twitter:creator`; Base.astro renders description conditionally so pages can ship without it.
2. **Agent-readiness is missing** — no `llms.txt`, no AI crawler rules in robots.txt. As AI-powered search becomes primary discovery for consulting services, this is a first-class concern.
3. **PostHog loads without GDPR safeguards** — the snippet fires for all visitors with no cookie consent gating. On a German consulting site this creates direct legal exposure under DSGVO.
4. **Cal.com embed is GDPR non-compliant** — Cal.com sets persistent third-party cookies that cannot be disabled via configuration. The embed must be replaced before the contact page goes live.
5. **~100 library entries and blog posts exist in pre-written form** but have no import tooling — no script to convert them to Astro-compatible Markdown with correct frontmatter.
6. **Images are not yet integrated** — hero, card, and OG image slots contain placeholder divs.

The site cannot go live safely until items 1–4 are resolved and content tooling (item 5) is in place.

## Vision

Opening the site for the first time feels complete: Google finds it, understands it structurally, and renders rich results. An AI assistant crawling the site understands immediately who André is, what he does, and how to surface his work. The contact page offers a clean, branded booking experience with no third-party cookies, matching the site's design language exactly. The CMS workflow for adding new library entries and insights is a single command that converts a structured input file into properly formatted Markdown — no manual frontmatter wrangling required.

## Out of Scope

German-language content is explicitly deferred. The language switcher is already disabled. DE pages exist structurally but will not receive content until a separate content sprint. This ISA does not cover DE content population.

Image sourcing and final image production are also deferred — the import tooling and placeholder system remain in place; the ISA covers the integration points but not the creative work of producing the images themselves.

Zoho Bookings account setup (workspace creation, service configuration, availability rules) is André's responsibility — this ISA covers the API integration code only.

Marketing content (testimonials, working-context editorial photo, podcast cover art for the homepage) is deferred to a design/content sprint.

## Principles

1. **GDPR by default** — no third-party tracking or booking scripts load without explicit architectural justification. Cookieless-first is the design choice; cookie consent banners are avoided by removing the need for them.
2. **No third-party scripts on the page** — all external service integrations (Zoho Booking, analytics) are either server-side proxied or configured in a mode that requires no client-side scripts from external domains.
3. **SEO is infrastructure, not polish** — sitemap, robots, and structured data are mandatory pre-launch items, not nice-to-haves.
4. **Agent-readiness is a first-class SEO concern** — `llms.txt` and AI-crawler rules belong in the same sprint as traditional SEO infrastructure.
5. **Import tooling must be non-destructive** — existing content files are never overwritten without an explicit `--force` flag. Running the import twice must produce the same result.
6. **Design system fidelity** — the Zoho Booking component must use the site's design tokens (`--gold`, `--bg-card`, BEM classes) and look indistinguishable from a native component.

## Constraints

- Static output (`output: 'static'`) — no server-side rendering. Booking API calls must go through Cloudflare Pages Functions (`export const prerender = false`).
- Cloudflare Adapter — all server-side env vars read from `locals.runtime.env`, not `process.env`.
- No Tailwind, no CSS frameworks, no UI frameworks — vanilla JS and BEM throughout.
- No `slug` field in frontmatter of any content collection — it overrides the glob loader's ID and breaks language filtering (confirmed CLAUDE.md critical note).
- Zoho OAuth pattern already established in `src/pages/api/contact.ts` — Bookings API must reuse the same OAuth2 refresh-token flow with `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`.
- All PostHog changes must preserve the existing `person_profiles: 'identified_only'` and EU endpoint.
- `bun` / `bunx` always; never `npm` / `npx`. Import scripts are `.mjs` (existing pattern) but may use Node 22.

## Goal

andredaus.com is safe to launch: it has a sitemap, robots.txt, JSON-LD structured data, agent-readiness (llms.txt + AI crawler rules), GDPR-compliant analytics (PostHog cookieless mode), a GDPR-compliant booking experience (Zoho Booking API — no Cal.com), and a repeatable import workflow for library entries and insights articles. Every deliverable is verifiable by a single tool call.

## Criteria

### A — SEO Infrastructure

- [ ] ISC-1: `@astrojs/sitemap` is listed in `package.json` dependencies
- [ ] ISC-2: `astro.config.mjs` imports and registers the sitemap integration
- [ ] ISC-3: `public/robots.txt` exists
- [ ] ISC-4: robots.txt contains `Sitemap:` directive pointing to `https://andredaus.com/sitemap-index.xml`
- [ ] ISC-5: robots.txt has `User-agent: *` with `Allow: /` as the default rule
- [ ] ISC-6: Base.astro `description` prop is required (not optional) — no page may omit it
- [ ] ISC-7: Base.astro renders `<meta property="og:locale">` — `en_US` for EN, `de_DE` for DE
- [ ] ISC-8: Base.astro renders `<meta property="og:image:width">` and `og:image:height` when `ogImage` prop is present
- [ ] ISC-9: Base.astro renders `<meta name="twitter:creator" content="@andredaus">` (or correct handle)
- [ ] ISC-10: Base.astro renders a `<script type="application/ld+json">` WebSite schema on every page
- [ ] ISC-11: WebSite schema includes `name`, `url`, `description`, and `sameAs` array (LinkedIn, podcast)
- [ ] ISC-12: `about.astro` renders a JSON-LD Person schema with name, jobTitle, url, sameAs
- [ ] ISC-13: `insights/[...slug].astro` renders a JSON-LD Article schema for published entries
- [ ] ISC-14: Article schema includes `headline`, `datePublished`, `author`, `url`
- [ ] ISC-15: `podcast/index.astro` renders a JSON-LD PodcastSeries schema
- [ ] ISC-16: `podcast/[...slug].astro` renders a JSON-LD PodcastEpisode schema per entry
- [ ] ISC-17: PodcastEpisode schema includes `name`, `datePublished`, `url`, `audio` (if `audio_url` present)
- [ ] ISC-18: `library/index.astro` renders a JSON-LD ItemList schema listing the library entries
- [ ] ISC-19: All JSON-LD `<script>` tags are placed inside `<head>` (not `<body>`)
- [ ] ISC-20: All insight single pages pass `og_title` (not plain `title`) to Base.astro `title` prop for OG
- [ ] ISC-21: All podcast single pages pass `og_title` to Base.astro
- [ ] ISC-22: `astro.config.mjs` sitemap integration excludes draft pages via `filter` or `customPages`
- [ ] ISC-23: `hreflang` alternates are present in `<head>` for EN/DE page pairs
- [ ] ISC-24: `<link rel="alternate" hreflang="x-default">` points to EN URL
- [ ] ISC-25: `opposition.astro` renders a JSON-LD Person schema (same as about, methodology context)

### B — Agent-Readiness

- [ ] ISC-26: `public/llms.txt` file exists
- [ ] ISC-27: llms.txt starts with `# André Daus` followed by a one-line site description
- [ ] ISC-28: llms.txt has `## About` section — who André is, the Strategic Opposition methodology, location
- [ ] ISC-29: llms.txt has `## Services` section listing each service with a brief description and URL
- [ ] ISC-30: llms.txt has `## Insights` section with URL to the insights archive
- [ ] ISC-31: llms.txt has `## Podcast` section with Iconoclast Insights description and archive URL
- [ ] ISC-32: llms.txt has `## Library` section explaining the cognitive bias/liberating structure/mental model reference
- [ ] ISC-33: llms.txt has `## Contact` section with contact URL and email
- [ ] ISC-34: llms.txt specifies `## Permissions` clarifying what AI tools may use the content for
- [ ] ISC-35: robots.txt has `User-agent: GPTBot` rule (OpenAI crawler)
- [ ] ISC-36: robots.txt has `User-agent: Claude-Web` rule (Anthropic crawler)
- [ ] ISC-37: robots.txt has `User-agent: CCBot` rule (Common Crawl)
- [ ] ISC-38: robots.txt has `User-agent: Google-Extended` rule (Google AI training)
- [ ] ISC-39: All AI crawler rules are `Allow: /` (public content may be indexed by AI tools)
- [ ] ISC-40: WebSite JSON-LD `sameAs` includes podcast platform URLs (Spotify, Apple Podcasts)

### C — PostHog GDPR (Cookieless Mode)

- [ ] ISC-41: PostHog `persistence` option is set to `'memory'` in the init call in Base.astro
- [ ] ISC-42: PostHog `disable_session_recording` is set to `true`
- [ ] ISC-43: PostHog `autocapture` is set to `false`
- [ ] ISC-44: PostHog `capture_pageview` is explicitly set to `true` (pageview tracking is retained)
- [ ] ISC-45: PostHog `person_profiles` remains `'identified_only'`
- [ ] ISC-46: PostHog api_host remains `https://eu.i.posthog.com`
- [ ] ISC-47: No cookie consent banner component is added (cookieless mode eliminates the need)
- [ ] ISC-48: PostHog init block still only renders when `PUBLIC_POSTHOG_KEY` env var is set
- [ ] ISC-49: CLAUDE.md documents the GDPR rationale for the cookieless configuration
- [ ] ISC-50: Anti: PostHog init call does NOT set `persistence: 'localStorage+cookie'` or `'cookie'`

### D — Zoho Booking Integration

- [ ] ISC-51: `contact.astro` no longer references `PUBLIC_CALCOM_USERNAME`
- [ ] ISC-52: `contact.astro` no longer contains `<div id="cal-booking">`
- [ ] ISC-53: `contact.astro` no longer contains any Cal.com script loading logic
- [ ] ISC-54: `src/components/ZohoBooking.astro` component file exists
- [ ] ISC-55: ZohoBooking accepts props: `isDE: boolean`
- [ ] ISC-56: ZohoBooking renders a week-navigation date selector
- [ ] ISC-57: ZohoBooking renders available time slots for selected date (populated via JS fetch)
- [ ] ISC-58: ZohoBooking renders a name and email input field
- [ ] ISC-59: ZohoBooking shows a success state with booking confirmation after successful POST
- [ ] ISC-60: ZohoBooking shows an error state with a mailto fallback link on API failure
- [ ] ISC-61: ZohoBooking text strings are bilingual (EN/DE) using `isDE` prop
- [ ] ISC-62: ZohoBooking uses only design system CSS tokens — no inline colors, no external CSS
- [ ] ISC-63: ZohoBooking uses BEM class naming (`zoho-booking`, `zoho-booking__slot`, etc.)
- [ ] ISC-64: `src/pages/api/zoho-booking-slots.ts` Cloudflare Pages Function created
- [ ] ISC-65: slots endpoint exports `export const prerender = false`
- [ ] ISC-66: slots endpoint reads env from `locals.runtime.env` (Cloudflare adapter pattern)
- [ ] ISC-67: slots endpoint accepts `date` query param (ISO date string `YYYY-MM-DD`)
- [ ] ISC-68: slots endpoint exchanges Zoho OAuth refresh token for access token
- [ ] ISC-69: slots endpoint calls Zoho Bookings API to get available slots for requested date
- [ ] ISC-70: slots endpoint returns `{ slots: string[] }` — array of available ISO time strings
- [ ] ISC-71: slots endpoint returns `{ slots: [] }` (not 500) when no slots are available
- [ ] ISC-72: `src/pages/api/zoho-booking-create.ts` Cloudflare Pages Function created
- [ ] ISC-73: create endpoint exports `export const prerender = false`
- [ ] ISC-74: create endpoint validates `name` (non-empty), `email` (format), `date`, `time` server-side
- [ ] ISC-75: create endpoint checks honeypot field `_trap` — silently discards if set
- [ ] ISC-76: create endpoint exchanges Zoho OAuth refresh token for access token
- [ ] ISC-77: create endpoint calls Zoho Bookings create-appointment API
- [ ] ISC-78: create endpoint returns `{ ok: true, booking_id: string }` on success
- [ ] ISC-79: create endpoint returns `{ ok: false, message: string }` on validation or API failure
- [ ] ISC-80: `.env.example` updated with `PUBLIC_ZOHO_BOOKING_SERVICE` and `PUBLIC_ZOHO_BOOKING_WORKSPACE`
- [ ] ISC-81: CLAUDE.md env vars table updated with the two new Zoho Booking env vars
- [ ] ISC-82: CLAUDE.md env vars table removes `PUBLIC_CALCOM_USERNAME` entry
- [ ] ISC-83: Anti: No `cal.com` domain appears in any `<script src>` or fetch call in the built output
- [ ] ISC-84: Anti: ZohoBooking component does NOT load any `zoho.com` or `zohobookings.com` JavaScript onto the page — all API calls are server-side via Pages Functions

### E — Library Import Tooling

- [ ] ISC-85: `scripts/import-library.mjs` file exists
- [ ] ISC-86: import-library script reads input from a JSON or NDJSON file path passed as first CLI argument
- [ ] ISC-87: input JSON schema requires `title` (string), `type` (bias|structure|method), `definition` (string)
- [ ] ISC-88: input JSON schema optionally accepts `summary`, `first_described`, `applies_to`, `risk_level`, `tags`, `related_entries`, `body` (Markdown body text)
- [ ] ISC-89: import-library script derives filename slug from `title` (lowercase, spaces→hyphens, umlauts→ascii, strip punctuation)
- [ ] ISC-90: import-library script writes files to `src/content/library/en/{slug}.md`
- [ ] ISC-91: import-library script sets `og_title` as `"{title} — Library · André Daus"` if not provided in input
- [ ] ISC-92: import-library script skips existing files without `--force` flag
- [ ] ISC-93: import-library script with `--force` flag overwrites existing files
- [ ] ISC-94: import-library script validates `type` against allowed enum (`bias`, `structure`, `method`) and exits with error if invalid
- [ ] ISC-95: import-library script prints a summary: `✓ N created, ✗ N skipped, ! N errors`
- [ ] ISC-96: Anti: import-library script does NOT write a `slug` field into frontmatter
- [ ] ISC-97: `scripts/import-library.mjs` is registered in `package.json` scripts as `import:library`

### F — Insights Import Tooling

- [ ] ISC-98: `scripts/import-insights.mjs` file exists
- [ ] ISC-99: import-insights script reads input from a JSON or NDJSON file path passed as first CLI argument
- [ ] ISC-100: input JSON schema requires `title`, `date` (ISO date string), `category`, `body` (Markdown)
- [ ] ISC-101: input JSON schema optionally accepts `summary`, `og_title`, `tags`
- [ ] ISC-102: import-insights script derives filename slug from `title`
- [ ] ISC-103: import-insights script writes files to `src/content/insights/en/{slug}.md`
- [ ] ISC-104: import-insights script sets `status: draft` by default on all imported entries
- [ ] ISC-105: import-insights script sets `category` from input or falls back to `'Strategy'`
- [ ] ISC-106: import-insights script skips existing files without `--force`
- [ ] ISC-107: import-insights script prints a summary: `✓ N created, ✗ N skipped, ! N errors`
- [ ] ISC-108: Anti: import-insights script does NOT write a `slug` field into frontmatter
- [ ] ISC-109: `scripts/import-insights.mjs` is registered in `package.json` scripts as `import:insights`
- [ ] ISC-110: `docs/content-import-format.md` exists documenting both import script input schemas

### G — Build Integrity

- [ ] ISC-111: `npm run build` (or `astro build` after scripts) completes without errors after all changes
- [ ] ISC-112: No TypeScript errors in any edited `.astro` or `.ts` file (checked via `astro check`)
- [ ] ISC-113: `astro.config.mjs` `site` field is `https://andredaus.com`
- [ ] ISC-114: All JSON-LD inline data uses `https://andredaus.com` as base URL (not localhost or staging)

### I — IterativeDepth Additions (THINK phase)

- [ ] ISC-129: `getStaticPaths` in `insights/[...slug].astro` filters out entries with `status: draft`
- [ ] ISC-130: `getStaticPaths` in `use-cases/[...slug].astro` filters out entries with `status: draft`
- [ ] ISC-131: `getStaticPaths` in `podcast/[...slug].astro` filters out entries with `status: draft`
- [ ] ISC-132: ZohoBooking component shows a loading indicator while slots are being fetched
- [ ] ISC-133: ZohoBooking component shows an error message (not empty silence) when slot fetch fails
- [ ] ISC-134: ZohoBooking fallback message on slot failure links to `mailto:hello@andredaus.com`
- [ ] ISC-135: Zoho OAuth token exchange failure in either API endpoint returns `{ ok: false, message: "Booking service temporarily unavailable" }` — not a 500
- [ ] ISC-136: All JSON-LD blocks are constructed via `JSON.stringify()` on a plain JS object — NOT via template string interpolation (prevents XSS and JSON breakage)
- [ ] ISC-137: Sitemap does NOT include `/404`, `/api/*`, or `/de/api/*` URLs
- [ ] ISC-138: import-library script wraps multi-word frontmatter string values in double-quoted YAML strings to safely handle em dashes, curly quotes, and special characters
- [ ] ISC-139: Available time slots from Zoho Bookings API are returned to the client in ISO 8601 UTC; ZohoBooking component uses `Intl.DateTimeFormat` to display them in the visitor's local timezone
- [ ] ISC-140: Base.astro `ogImage` prop has a fallback default OG image path (`/og-default.png`) when no content-specific image is provided
- [ ] ISC-141: `public/og-default.png` (or `.jpg`) exists — a brand-appropriate 1200×630 fallback OG image
- [ ] ISC-142: Contact page includes a brief data-processing notice near the booking form referencing the privacy policy
- [ ] ISC-143: llms.txt `## Permissions` section explicitly distinguishes AI discovery/indexing (permitted) from AI model training on proprietary content (not permitted without license)
- [ ] ISC-144: Library ItemList JSON-LD uses only `name` and `url` per item — no full `definition` or `summary` inline to keep the `<script>` block small
- [ ] ISC-145: import-library script does NOT validate that `related_entries` slugs exist on disk — writes them as-is and defers cross-reference validation to `astro build`

### H — Global Anti-criteria

- [ ] ISC-115: Anti: No `<slug>` field appears in any newly created or modified content file frontmatter
- [ ] ISC-116: Anti: robots.txt does NOT disallow `Googlebot` or `Bingbot`
- [ ] ISC-117: Anti: sitemap does NOT include pages with `status: draft`
- [ ] ISC-118: Anti: JSON-LD blocks do NOT appear inside `<body>` — all must be in `<head>` via Base.astro or page `<head>` slot
- [ ] ISC-119: Anti: EN and DE variants of the same page do NOT share a canonical URL — each has its own
- [ ] ISC-120: Anti: PostHog does NOT set any cookies or write to `localStorage` (verified by reading init config — `persistence: 'memory'`)
- [ ] ISC-121: Anti: No `cal.com` string appears anywhere in `src/pages/contact.astro` after migration
- [ ] ISC-122: Anti: The Zoho Booking create endpoint does NOT log or return the Zoho `REFRESH_TOKEN` in any response
- [ ] ISC-123: Anti: import scripts do NOT silently succeed on invalid input — they must exit non-zero and print the error
- [ ] ISC-124: Anti: `docs/content-import-format.md` does NOT document `slug` as an input field
- [ ] ISC-125: Anti: llms.txt does NOT include private contact details (home address, phone number)
- [ ] ISC-126: Anti: `astro check` does NOT produce errors from new JSON-LD inline objects being untyped
- [ ] ISC-127: Anti: hreflang alternates do NOT point to the same URL (EN hreflang on EN page must not equal DE hreflang on same page)
- [ ] ISC-128: Anti: Zoho OAuth access token is NOT written to any log, response body, or error message

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|-----|------|-------|-----------|------|
| ISC-1 | file | `rg "@astrojs/sitemap" package.json` | match | Bash/Grep |
| ISC-2 | file | `rg "sitemap" astro.config.mjs` | match | Bash/Grep |
| ISC-3 | file | `ls public/robots.txt` | exists | Bash |
| ISC-4 | content | `rg "Sitemap:" public/robots.txt` | match | Bash |
| ISC-5 | content | `rg "Allow: /" public/robots.txt` | match | Bash |
| ISC-6 | code | `rg "description.*required\|description.*z\.string()" src/layouts/Base.astro` or check Props interface | no optional | Read |
| ISC-10 | code | `rg "application/ld\+json" src/layouts/Base.astro` | match | Grep |
| ISC-12 | code | `rg "application/ld\+json" src/pages/about.astro` | match | Grep |
| ISC-13 | code | `rg "application/ld\+json" src/pages/insights/\[...slug\].astro` | match | Grep |
| ISC-26 | file | `ls public/llms.txt` | exists | Bash |
| ISC-35–39 | content | `rg "GPTBot\|Claude-Web\|CCBot\|Google-Extended" public/robots.txt` | 4 matches | Grep |
| ISC-41 | code | `rg "persistence.*memory" src/layouts/Base.astro` | match | Grep |
| ISC-42 | code | `rg "disable_session_recording.*true" src/layouts/Base.astro` | match | Grep |
| ISC-43 | code | `rg "autocapture.*false" src/layouts/Base.astro` | match | Grep |
| ISC-51–53 | code | `rg "CALCOM\|cal-booking\|cal\.com" src/pages/contact.astro` | no match | Grep |
| ISC-54 | file | `ls src/components/ZohoBooking.astro` | exists | Bash |
| ISC-64 | file | `ls src/pages/api/zoho-booking-slots.ts` | exists | Bash |
| ISC-72 | file | `ls src/pages/api/zoho-booking-create.ts` | exists | Bash |
| ISC-83–84 | code | `rg "cal\.com\|zohobookings\.com" src/components/ZohoBooking.astro src/pages/contact.astro` | no match | Grep |
| ISC-85 | file | `ls scripts/import-library.mjs` | exists | Bash |
| ISC-96 | code | Read import-library.mjs and confirm no `slug:` in output template | no match | Read |
| ISC-98 | file | `ls scripts/import-insights.mjs` | exists | Bash |
| ISC-108 | code | Read import-insights.mjs and confirm no `slug:` in output template | no match | Read |
| ISC-110 | file | `ls docs/content-import-format.md` | exists | Bash |
| ISC-111 | build | `astro build` exits 0 | exit code 0 | Bash |
| ISC-115–128 | content | grep for anti-patterns in modified files | no match | Grep |

## Features

| Name | Description | Satisfies | Depends On | Parallelizable |
|------|-------------|-----------|------------|----------------|
| seo-sitemap | Install @astrojs/sitemap, register in astro.config.mjs, configure draft exclusion | ISC-1,2,22 | — | true |
| seo-robots | Create public/robots.txt with default rules, sitemap directive, AI crawler rules | ISC-3,4,5,35,36,37,38,39 | — | true |
| seo-base-meta | Update Base.astro: og:locale, og:image dims, twitter:creator, make description required | ISC-6,7,8,9 | — | false |
| seo-jsonld-base | Add WebSite JSON-LD to Base.astro, Person schema to about.astro and opposition.astro | ISC-10,11,12,19,25,40,113,114 | seo-base-meta | false |
| seo-jsonld-collections | Add Article schema to insights/[...slug].astro; PodcastSeries to podcast/index.astro; PodcastEpisode to podcast/[...slug].astro; ItemList to library/index.astro | ISC-13,14,15,16,17,18,20,21 | seo-jsonld-base | true |
| seo-hreflang | Add hreflang alternate links to all bilingual pages in Base.astro or page head | ISC-23,24 | seo-base-meta | false |
| agent-readiness | Create public/llms.txt with all required sections | ISC-26,27,28,29,30,31,32,33,34 | — | true |
| posthog-gdpr | Update PostHog init in Base.astro to cookieless mode (persistence: memory, disable recording, no autocapture) | ISC-41,42,43,44,45,46,47,48,49,50,120 | — | true |
| zoho-booking-ui | Create ZohoBooking.astro component; replace Cal.com block in contact.astro | ISC-51,52,53,54,55,56,57,58,59,60,61,62,63,83,84,121 | — | false |
| zoho-booking-api | Create zoho-booking-slots.ts and zoho-booking-create.ts Pages Functions | ISC-64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,122,128 | — | false |
| zoho-booking-config | Update .env.example and CLAUDE.md with new/removed env vars | ISC-80,81,82 | zoho-booking-api | false |
| library-import | Create scripts/import-library.mjs with full validation, slug gen, frontmatter writer | ISC-85,86,87,88,89,90,91,92,93,94,95,96,97,123 | — | true |
| insights-import | Create scripts/import-insights.mjs with full validation, slug gen, frontmatter writer | ISC-98,99,100,101,102,103,104,105,106,107,108,109,123 | — | true |
| content-import-docs | Create docs/content-import-format.md documenting both import script schemas | ISC-110,124 | library-import, insights-import | false |
| build-verify | Run astro check + npm run build; confirm no errors | ISC-111,112,113,114 | all above | false |

## Decisions

- 2026-05-07: PostHog GDPR approach — chose cookieless mode (`persistence: 'memory'`) over adding a cookie consent banner. Rationale: a consulting site for a German operator has strict DSGVO exposure. Cookieless mode provides compliant anonymous analytics without the UX penalty of a cookie banner. PostHog's EU endpoint with `person_profiles: 'identified_only'` and `persistence: 'memory'` collects no persistent identifiers and sets no cookies.
- 2026-05-07: Zoho Booking vs Cal.com — Cal.com sets persistent tracking cookies (analytics, marketing) that cannot be disabled via the embed API. Zoho Bookings API is used instead via a server-side Cloudflare Pages Function, keeping zero third-party scripts on the contact page.
- 2026-05-07: Agent-readiness scope — `llms.txt` is an emerging but real standard (llmstxt.org); Google has incorporated structured content into AI Overviews. For a strategic consulting site targeting business decision-makers who increasingly use AI tools for research, llms.txt is a first-class pre-launch item. AI crawler rules in robots.txt default to Allow (public content may be indexed) since discovery is commercially desirable.
- 2026-05-07: hreflang — EN pages use `hreflang="en"` and `hreflang="x-default"`. DE pages use `hreflang="de"`. Implemented in Base.astro using the `lang` prop to derive the alternate URL.
- 2026-05-07: Import scripts use `.mjs` to match the existing `import-podcast.mjs`, `generate-summaries.mjs` pattern. Node 22 is required (per `engines` field in package.json).

## Changelog

_(empty at OBSERVE — entries added at LEARN when conjectures are refuted)_

## Verification

_(empty at OBSERVE — populated during EXECUTE/VERIFY as ISCs pass)_
