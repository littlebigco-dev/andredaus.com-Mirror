/**
 * AI summary generation script
 *
 * Finds content files with a missing or empty `summary` field and calls the
 * Anthropic Messages API to generate a 1–2 sentence summary, then writes it
 * back into the frontmatter.
 *
 * Target collections: insights, use-cases, library, podcast
 * (Services and FAQs are excluded — no `summary` field.)
 *
 * Usage:
 *   node scripts/generate-summaries.mjs
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-summaries.mjs
 *
 * If ANTHROPIC_API_KEY is not set, the script exits cleanly (no-op).
 *
 * Model: claude-haiku-4-5-20251001 (fast + cheap for batch generation)
 * Rate limiting: 500 ms delay between API calls to avoid hitting limits.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.log('[generate-summaries] ANTHROPIC_API_KEY not set — skipping summary generation.');
  process.exit(0);
}

const CONTENT_ROOT = resolve('src/content');
const COLLECTIONS = ['insights', 'use-cases', 'library', 'podcast'];

const MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const RATE_LIMIT_MS = 500;

// ── File helpers ─────────────────────────────────────────────────────────────

async function getMarkdownFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n?)([\s\S]*)$/);
  if (!match) return null;
  return {
    raw: match[1],
    sep: match[2],
    body: match[3],
  };
}

function getFmValue(raw, key) {
  const re = new RegExp(`^${key}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, 'm');
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

function setFmValue(raw, key, value) {
  const escaped = value.replace(/"/g, '\\"');
  if (new RegExp(`^${key}:`, 'm').test(raw)) {
    return raw.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: "${escaped}"`);
  }
  // Insert after title field if it exists, otherwise append
  if (/^title:/m.test(raw)) {
    return raw.replace(/^(title:.*)$/m, `$1\n${key}: "${escaped}"`);
  }
  return `${raw}\n${key}: "${escaped}"`;
}

// ── Anthropic API ────────────────────────────────────────────────────────────

async function generateSummary(title, body, collection) {
  const collectionContext = {
    'insights': 'a business/consulting insights article on Strategic Opposition methodology',
    'use-cases': 'a consulting use-case article using the PAS (Problem-Agitation-Solution) framework',
    'library': 'a reference entry in a knowledge library (could be a cognitive bias, mental model, or liberating structure)',
    'podcast': 'a podcast episode',
  }[collection] || 'a consulting article';

  const contentSample = body.trim().slice(0, 2000);

  const prompt = `You are writing a short summary for ${collectionContext}.

Title: ${title}

Content (excerpt):
${contentSample}

Write a single sentence (max 200 characters) that describes what this ${collection === 'library' ? 'concept' : 'content'} is about. Be specific and informative — avoid generic phrases like "This article explores" or "This entry discusses". Start directly with the subject matter.`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const summary = data.content?.[0]?.text?.trim();
  if (!summary) throw new Error('Empty response from API');
  return summary;
}

// ── Per-file processing ──────────────────────────────────────────────────────

async function processFile(filePath, collection) {
  const content = await readFile(filePath, 'utf8');
  const parsed = parseFrontmatter(content);
  if (!parsed) return false;

  const { raw, sep, body } = parsed;

  const existingSummary = getFmValue(raw, 'summary');
  if (existingSummary && existingSummary.length > 10) return false; // already has summary

  const title = getFmValue(raw, 'title');
  if (!title) {
    console.warn(`[generate-summaries] No title in ${filePath} — skipping`);
    return false;
  }

  const status = getFmValue(raw, 'status');
  // Skip drafts that have no body content — nothing to summarise
  if ((!body || body.trim().length < 50) && status === 'draft') {
    console.log(`[generate-summaries] Skipping draft with no body: ${filePath}`);
    return false;
  }

  console.log(`[generate-summaries] Generating summary for: ${title}`);

  let summary;
  try {
    summary = await generateSummary(title, body, collection);
  } catch (err) {
    console.error(`[generate-summaries] Failed for ${filePath}: ${err.message}`);
    return false;
  }

  const updatedRaw = setFmValue(raw, 'summary', summary);
  const updatedContent = `---\n${updatedRaw}\n---${sep}${body}`;
  await writeFile(filePath, updatedContent, 'utf8');

  console.log(`[generate-summaries] ✓ ${filePath}`);
  console.log(`[generate-summaries]   "${summary}"`);
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let generated = 0;
  let skipped = 0;

  for (const collection of COLLECTIONS) {
    const collectionDir = join(CONTENT_ROOT, collection);
    const files = await getMarkdownFiles(collectionDir);

    for (const file of files) {
      const updated = await processFile(file, collection);
      if (updated) {
        generated++;
        // Rate limit between API calls
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      } else {
        skipped++;
      }
    }
  }

  console.log(`[generate-summaries] Done. Generated ${generated} summaries, skipped ${skipped} files.`);
}

main().catch(err => {
  console.error('[generate-summaries] Fatal error:', err);
  process.exit(1);
});
