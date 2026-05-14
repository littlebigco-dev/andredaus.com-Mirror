/**
 * Import insight articles from a JSON or NDJSON file.
 *
 * Usage:
 *   node scripts/import-insights.mjs <input-file> [--force] [--publish]
 *
 * Input format — JSON array or NDJSON (one object per line):
 *   {
 *     "title":    "Consensus Is Not Clarity",           // required
 *     "date":     "2025-11-20",                         // required, ISO date
 *     "category": "Psychology",                         // required: Strategy|Psychology|Technology|Business|Methodology
 *     "summary":  "Short description...",               // optional (AI-generated at build if omitted)
 *     "og_title": "Custom OG title",                    // optional
 *     "status":   "published",                          // optional, defaults to "draft"
 *     "body":     "Markdown body content..."            // optional, written after frontmatter
 *   }
 *
 * Flags:
 *   --force    Overwrite existing files
 *   --publish  Set status to "published" (overrides per-entry status)
 *
 * The script:
 * - Generates a kebab-case slug from title
 * - Writes to src/content/insights/en/<slug>.md
 * - Skips existing files unless --force is passed
 * - Does NOT write a slug field (glob loader uses file path as ID)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const outputDir = resolve(projectRoot, 'src/content/insights/en');

const VALID_CATEGORIES = new Set(['Strategy', 'Psychology', 'Technology', 'Business', 'Methodology']);

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

function normaliseDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return d.toISOString().slice(0, 10);
}

function buildFrontmatter(entry, status) {
  const lines = [
    '---',
    `title: ${yamlString(entry.title)}`,
    `date: ${normaliseDate(entry.date)}`,
    `category: ${entry.category}`,
    `status: ${status}`,
  ];

  if (entry.og_title) lines.push(`og_title: ${yamlString(entry.og_title)}`);
  if (entry.summary) lines.push(`summary: ${yamlString(entry.summary)}`);

  lines.push('---');
  return lines.join('\n');
}

function parseInput(filePath) {
  const raw = readFileSync(filePath, 'utf-8').trim();
  if (raw.startsWith('[')) return JSON.parse(raw);
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function validate(entry, index) {
  const errors = [];
  if (!entry.title) errors.push('missing title');
  if (!entry.date) errors.push('missing date');
  if (!entry.category) errors.push('missing category');
  else if (!VALID_CATEGORIES.has(entry.category)) {
    console.warn(`  WARN  Entry ${index}: category "${entry.category}" not in standard list — writing as-is`);
  }
  if (errors.length) {
    console.error(`Entry ${index}: ${errors.join(', ')}`);
    return false;
  }
  return true;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const publish = args.includes('--publish');
const inputFile = args.find(a => !a.startsWith('--'));

if (!inputFile) {
  console.error('Usage: node scripts/import-insights.mjs <input-file> [--force] [--publish]');
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

  const status = publish ? 'published' : (entry.status ?? 'draft');
  const frontmatter = buildFrontmatter(entry, status);
  const body = entry.body ? `\n${entry.body}\n` : '';
  writeFileSync(outputPath, `${frontmatter}${body}`, 'utf-8');
  console.log(`  WRITE ${slug}.md  [${status}]`);
  written++;
}

console.log(`\nDone: ${written} written, ${skipped} skipped, ${errored} errors`);
