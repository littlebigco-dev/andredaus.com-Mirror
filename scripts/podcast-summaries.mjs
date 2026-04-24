/**
 * scripts/podcast-summaries.mjs
 *
 * Generates OG summaries for podcast episodes where `summary` is missing or empty.
 * Uses the Anthropic API with the episode description as context.
 *
 * Usage:
 *   node scripts/podcast-summaries.mjs
 *   node scripts/podcast-summaries.mjs --dry-run   (preview without writing)
 *   node scripts/podcast-summaries.mjs --force      (regenerate all, even if summary exists)
 *
 * Requires ANTHROPIC_API_KEY in your .env or environment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env file if present (no external dependency needed)
try {
  const envContent = fs.readFileSync(
    path.resolve(__dirname, '../.env'),
    'utf-8'
  );
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ??= val;  // don't overwrite vars already set in the environment
  }
} catch { /* no .env file — rely on environment variables */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../src/content/podcast/en');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// ── Frontmatter helpers ───────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

function getField(yaml, field) {
  // Handles: field: "value" | field: value | field: |\n  multiline
  const singleLine = new RegExp(`^${field}:\\s*"?([^"\\n]+)"?\\s*$`, 'm');
  const blockScalar = new RegExp(`^${field}:\\s*\\|\\n([\\s\\S]*?)(?=\\n\\S|$)`, 'm');

  let m = yaml.match(blockScalar);
  if (m) return m[1].replace(/^  /gm, '').trim();

  m = yaml.match(singleLine);
  if (m) return m[1].trim();

  return null;
}

function setField(yaml, field, value) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const newLine = `${field}: "${escaped}"`;

  // Replace existing field (single-line or block scalar)
  const blockScalar = new RegExp(`^${field}:\\s*\\|\\n([\\s\\S]*?)(?=\\n\\S|\\n---)`, 'm');
  const singleLine = new RegExp(`^${field}:.*$`, 'm');

  if (blockScalar.test(yaml)) {
    return yaml.replace(blockScalar, newLine);
  } else if (singleLine.test(yaml)) {
    return yaml.replace(singleLine, newLine);
  } else {
    // Append before closing (before status: or end)
    return yaml + `\n${newLine}`;
  }
}

// ── Anthropic API ─────────────────────────────────────────────────────

async function generateSummary(title, description) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Write a single-sentence OG meta description for this podcast episode. Maximum 155 characters. No quotes. Plain text only. Sharp and direct — matching the show's contrarian tone.

Episode title: ${title}

Episode description:
${description}

Output only the sentence, nothing else.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text.trim().replace(/^["']|["']$/g, '');
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} episode files`);
  if (DRY_RUN) console.log('DRY RUN — no files will be written\n');

  let generated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      console.warn(`⚠  Could not parse frontmatter: ${file}`);
      continue;
    }

    const summary = getField(parsed.yaml, 'summary');
    const title = getField(parsed.yaml, 'title');
    const description = getField(parsed.yaml, 'description');

    if (summary && !FORCE) {
      skipped++;
      continue;
    }

    if (!description) {
      console.warn(`⚠  No description to work from: ${file}`);
      skipped++;
      continue;
    }

    process.stdout.write(`→ ${file} … `);

    try {
      if (DRY_RUN) {
        console.log('(would generate)');
        generated++;
        continue;
      }

      const newSummary = await generateSummary(title, description);
      const updatedYaml = setField(parsed.yaml, 'summary', newSummary);
      const updatedContent = `---\n${updatedYaml}\n---\n${parsed.body}`;
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
      console.log(`✓ "${newSummary.slice(0, 80)}…"`);
      generated++;

      // Polite rate limiting
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`✗ ${err.message}`);
    }
  }

  console.log(`\nDone. Generated: ${generated} | Skipped: ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
