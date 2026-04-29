/**
 * scripts/generate-summaries.mjs
 *
 * Generates OG summaries for content files where `summary` is missing or empty.
 * Replaces both the old generate-summaries.mjs and podcast-summaries.mjs.
 *
 * Collections covered:
 *   podcast    → uses `description` frontmatter field (Spotify show notes)
 *   insights   → uses markdown body
 *   use-cases  → uses `scenario` frontmatter + markdown body
 *   library    → uses `definition` frontmatter + markdown body
 *
 * Language: auto-detected from path (/en/ → English, /de/ → German prompt)
 *
 * Usage:
 *   node scripts/generate-summaries.mjs            (skip existing summaries)
 *   node scripts/generate-summaries.mjs --force    (regenerate all)
 *   node scripts/generate-summaries.mjs --dry-run  (preview without writing)
 *   node scripts/generate-summaries.mjs --collection=podcast  (one collection only)
 *
 * Requires ANTHROPIC_API_KEY in environment or .env file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname must be defined first — used by .env loader below
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env (no external dependencies) ─────────────────────────────

try {
  const envPath = path.resolve(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ??= val; // don't overwrite vars already in the environment
  }
} catch { /* no .env file — rely on environment variables */ }

// ── Config ────────────────────────────────────────────────────────────

const API_KEY      = process.env.ANTHROPIC_API_KEY;
const CONTENT_ROOT = path.resolve(__dirname, '../src/content');
const DRY_RUN      = process.argv.includes('--dry-run');
const FORCE        = process.argv.includes('--force');
const ONLY         = process.argv.find(a => a.startsWith('--collection='))?.split('=')[1];

const COLLECTIONS  = ['podcast', 'insights', 'use-cases', 'library'];

// ── Collection strategy ───────────────────────────────────────────────

const STRATEGY = {
  podcast: {
    // Source: `description` frontmatter field (Spotify show notes — rich and specific)
    getContext(fields, _body) {
      return fields.description || null;
    },
    prompt(title, context, lang) {
      if (lang === 'de') {
        return `Schreib eine einzelne OG-Meta-Beschreibung für diese Podcast-Episode. Maximal 155 Zeichen. Keine Anführungszeichen. Nur Klartext. Direkt und pointiert — im konträren Ton der Show.

Episodentitel: ${title}

Episodenbeschreibung:
${context}

Gib nur den Satz aus, nichts anderes.`;
      }
      return `Write a single-sentence OG meta description for this podcast episode. Maximum 155 characters. No quotes. Plain text only. Sharp and direct — matching the show's contrarian tone.

Episode title: ${title}

Episode description:
${context}

Output only the sentence, nothing else.`;
    },
  },

  insights: {
    // Source: markdown body (the article itself — first 2000 chars)
    getContext(_fields, body) {
      const trimmed = body.trim();
      return trimmed.length > 50 ? trimmed.slice(0, 2000) : null;
    },
    prompt(title, context, lang) {
      if (lang === 'de') {
        return `Schreib eine einzelne OG-Meta-Beschreibung für diesen Consulting-Artikel über Strategic Opposition. Maximal 155 Zeichen. Keine Anführungszeichen. Direkt — keine generischen Phrasen wie "Dieser Artikel erklärt".

Titel: ${title}

Inhalt (Auszug):
${context}

Gib nur den Satz aus.`;
      }
      return `Write a single-sentence OG meta description for this Strategic Opposition consulting insight. Maximum 155 characters. No quotes. Sharp and direct — no generic openers like "This article explores".

Title: ${title}

Content excerpt:
${context}

Output only the sentence.`;
    },
  },

  'use-cases': {
    // Source: `scenario` frontmatter (concrete situation) + body
    getContext(fields, body) {
      const scenario = fields.scenario || '';
      const bodyExcerpt = body.trim().slice(0, 1500);
      const combined = [scenario, bodyExcerpt].filter(Boolean).join('\n\n');
      return combined.length > 30 ? combined : null;
    },
    prompt(title, context, lang) {
      if (lang === 'de') {
        return `Schreib eine einzelne OG-Meta-Beschreibung für diesen Consulting Use Case. Maximal 155 Zeichen. Keine Anführungszeichen. Konkret und direkt — kein generischer Einstieg.

Titel: ${title}

Szenario und Inhalt:
${context}

Gib nur den Satz aus.`;
      }
      return `Write a single-sentence OG meta description for this consulting use case. Maximum 155 characters. No quotes. Concrete and direct — no generic openers.

Title: ${title}

Scenario and content:
${context}

Output only the sentence.`;
    },
  },

  library: {
    // Source: `definition` frontmatter (precise concept definition) + body
    getContext(fields, body) {
      const definition = fields.definition || '';
      const bodyExcerpt = body.trim().slice(0, 1000);
      const combined = [definition, bodyExcerpt].filter(Boolean).join('\n\n');
      return combined.length > 20 ? combined : null;
    },
    prompt(title, context, lang) {
      if (lang === 'de') {
        return `Schreib eine einzelne OG-Meta-Beschreibung für diesen Library-Eintrag (Bias, Methode oder mentales Modell). Maximal 155 Zeichen. Keine Anführungszeichen. Informativ und präzise.

Konzept: ${title}

Definition und Inhalt:
${context}

Gib nur den Satz aus.`;
      }
      return `Write a single-sentence OG meta description for this knowledge library entry (bias, method, or mental model). Maximum 155 characters. No quotes. Informative and precise.

Concept: ${title}

Definition and content:
${context}

Output only the sentence.`;
    },
  },
};

// ── Frontmatter helpers ───────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

function parseFrontmatterFields(yaml) {
  const fields = {};
  const lines = yaml.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
    if (!keyMatch) { i++; continue; }
    const key = keyMatch[1];
    const rest = keyMatch[2].trim();
    if (rest === '|') {
      const indented = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        indented.push(lines[i].replace(/^  /, ''));
        i++;
      }
      fields[key] = indented.join('\n').trim();
    } else {
      fields[key] = rest.replace(/^["']|["']$/g, '').trim();
      i++;
    }
  }
  return fields;
}

function setFrontmatterField(yaml, key, value) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const newLine = `${key}: "${escaped}"`;
  const blockRe = new RegExp(`^${key}:\\s*\\|\\n([\\s\\S]*?)(?=\\n[a-zA-Z_]|$)`, 'm');
  if (blockRe.test(yaml)) return yaml.replace(blockRe, newLine);
  const lineRe = new RegExp(`^${key}:.*$`, 'm');
  if (lineRe.test(yaml)) return yaml.replace(lineRe, newLine);
  return `${yaml}\n${newLine}`;
}

// ── Anthropic API ─────────────────────────────────────────────────────

async function callAPI(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty API response');
  return text.replace(/^["']|["']$/g, '');
}

// ── File discovery ────────────────────────────────────────────────────

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

function detectLang(filePath) {
  return filePath.includes(`${path.sep}de${path.sep}`) ? 'de' : 'en';
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.log('[summaries] ANTHROPIC_API_KEY not set — skipping.');
    return;
  }

  const collections = ONLY
    ? COLLECTIONS.filter(c => c === ONLY)
    : COLLECTIONS;

  if (ONLY && collections.length === 0) {
    console.error(`[summaries] Unknown collection: ${ONLY}. Options: ${COLLECTIONS.join(', ')}`);
    process.exit(1);
  }

  if (DRY_RUN) console.log('[summaries] DRY RUN — no files will be written\n');

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const collection of collections) {
    const dir = path.join(CONTENT_ROOT, collection);
    const files = walkDir(dir);

    if (files.length === 0) {
      console.log(`[summaries] ${collection}: no files found — skipping`);
      continue;
    }

    console.log(`\n[summaries] ${collection} (${files.length} files)`);
    const strategy = STRATEGY[collection];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseFrontmatter(content);
      if (!parsed) { skipped++; continue; }

      const fields = parseFrontmatterFields(parsed.yaml);

      // Skip if summary already exists and we're not forcing
      if (fields.summary && fields.summary.length > 10 && !FORCE) {
        skipped++;
        continue;
      }

      // Skip drafts with no body content
      if (fields.status === 'draft' && parsed.body.trim().length < 50) {
        skipped++;
        continue;
      }

      const title = fields.title;
      if (!title) { skipped++; continue; }

      const context = strategy.getContext(fields, parsed.body);
      if (!context) {
        console.warn(`  ⚠  no context: ${path.basename(filePath)}`);
        skipped++;
        continue;
      }

      const lang = detectLang(filePath);
      const label = path.relative(CONTENT_ROOT, filePath);
      process.stdout.write(`  → ${label} … `);

      if (DRY_RUN) {
        console.log('(would generate)');
        generated++;
        continue;
      }

      try {
        const prompt = strategy.prompt(title, context, lang);
        const summary = await callAPI(prompt);
        const updatedYaml = setFrontmatterField(parsed.yaml, 'summary', summary);
        fs.writeFileSync(filePath, `---\n${updatedYaml}\n---\n${parsed.body}`, 'utf-8');
        console.log(`✓ "${summary.slice(0, 70)}…"`);
        generated++;
        await new Promise(r => setTimeout(r, 350));
      } catch (err) {
        console.error(`✗ ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n[summaries] Done. Generated: ${generated} | Skipped: ${skipped} | Errors: ${errors}`);
}

main().catch(err => {
  console.error('[summaries] Fatal error:', err);
  process.exit(1);
});
