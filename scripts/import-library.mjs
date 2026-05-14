/**
 * Import library entries from a JSON or NDJSON file.
 *
 * Usage:
 *   node scripts/import-library.mjs <input-file> [--force]
 *
 * Input format — JSON array or NDJSON (one object per line):
 *   {
 *     "title":       "Confirmation Bias",          // required
 *     "type":        "bias",                        // required: bias | structure | method
 *     "definition":  "The tendency to...",          // required
 *     "summary":     "Short description...",        // optional
 *     "applies_to":  "Individuals & organisations", // optional
 *     "risk_level":  "High — compounds silently",   // optional
 *     "first_described": "1960",                    // optional
 *     "tags":        ["Strategy", "Leadership"],    // optional
 *     "related_entries": ["authority-bias"],        // optional, array of slugs
 *     "og_title":    "Custom OG title"              // optional, defaults to title
 *   }
 *
 * The script:
 * - Generates a kebab-case slug from title
 * - Writes to src/content/library/en/<slug>.md
 * - Skips existing files unless --force is passed
 * - Does NOT write a slug field (glob loader uses file path as ID)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const outputDir = resolve(projectRoot, 'src/content/library/en');

const VALID_TYPES = new Set(['bias', 'structure', 'method']);

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function yamlString(value) {
  if (typeof value !== 'string') return String(value);
  if (value.includes('"') && !value.includes("'")) return `'${value}'`;
  if (/[:#\[\]{},|>&*!'"@%]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

function yamlStringArray(arr) {
  if (!arr || arr.length === 0) return '[]';
  return '\n' + arr.map(s => `  - ${yamlString(s)}`).join('\n');
}

function buildFrontmatter(entry) {
  const lines = [
    '---',
    `title: ${yamlString(entry.title)}`,
    `type: ${entry.type}`,
    `definition: ${yamlString(entry.definition)}`,
  ];

  if (entry.og_title) lines.push(`og_title: ${yamlString(entry.og_title)}`);
  if (entry.summary) lines.push(`summary: ${yamlString(entry.summary)}`);
  if (entry.first_described) lines.push(`first_described: ${yamlString(entry.first_described)}`);
  if (entry.applies_to) lines.push(`applies_to: ${yamlString(entry.applies_to)}`);
  if (entry.risk_level) lines.push(`risk_level: ${yamlString(entry.risk_level)}`);

  if (entry.tags && entry.tags.length > 0) {
    lines.push(`tags:${yamlStringArray(entry.tags)}`);
  }

  if (entry.related_entries && entry.related_entries.length > 0) {
    lines.push(`related_entries:${yamlStringArray(entry.related_entries)}`);
  }

  lines.push('---');
  return lines.join('\n');
}

function parseInput(filePath) {
  const raw = readFileSync(filePath, 'utf-8').trim();
  // Try JSON array first
  if (raw.startsWith('[')) return JSON.parse(raw);
  // Try NDJSON
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function validate(entry, index) {
  const errors = [];
  if (!entry.title) errors.push('missing title');
  if (!entry.type) errors.push('missing type');
  else if (!VALID_TYPES.has(entry.type)) errors.push(`invalid type "${entry.type}" (must be bias|structure|method)`);
  if (!entry.definition) errors.push('missing definition');
  if (errors.length) {
    console.error(`Entry ${index}: ${errors.join(', ')}`);
    return false;
  }
  return true;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const inputFile = args.find(a => !a.startsWith('--'));

if (!inputFile) {
  console.error('Usage: node scripts/import-library.mjs <input-file> [--force]');
  process.exit(1);
}

const entries = parseInput(resolve(process.cwd(), inputFile));
console.log(`Found ${entries.length} entries in ${inputFile}`);

mkdirSync(outputDir, { recursive: true });

let written = 0, skipped = 0, errored = 0;

for (let i = 0; i < entries.length; i++) {
  const entry = entries[i];

  if (!validate(entry, i + 1)) { errored++; continue; }

  const slug = slugify(entry.title);
  const outputPath = resolve(outputDir, `${slug}.md`);

  if (existsSync(outputPath) && !force) {
    console.log(`  SKIP  ${slug}.md (already exists, use --force to overwrite)`);
    skipped++;
    continue;
  }

  const frontmatter = buildFrontmatter(entry);
  const body = entry.body ? `\n${entry.body}\n` : '';
  writeFileSync(outputPath, `${frontmatter}${body}`, 'utf-8');
  console.log(`  WRITE ${slug}.md`);
  written++;
}

console.log(`\nDone: ${written} written, ${skipped} skipped, ${errored} errors`);
