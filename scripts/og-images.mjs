/**
 * OG Image generation script
 *
 * Scans all content files for entries that have `og_title` but no `og_image`.
 * For each, calls the Cloudflare Worker (OG_WORKER_URL env var) and writes
 * the returned image URL back into the frontmatter as `og_image`.
 *
 * Usage:
 *   node scripts/og-images.mjs
 *   OG_WORKER_URL=https://og.andredaus.com node scripts/og-images.mjs
 *
 * The worker is expected to accept:
 *   GET /?title=<encoded-og_title>
 * and return:
 *   { "url": "https://..." }
 *
 * Set OG_WORKER_URL in .env or Cloudflare Pages env vars.
 * If OG_WORKER_URL is not set, the script exits cleanly (no-op).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const WORKER_URL = process.env.OG_WORKER_URL;

if (!WORKER_URL) {
  console.log('[og-images] OG_WORKER_URL not set — skipping OG image generation.');
  process.exit(0);
}

const CONTENT_ROOT = resolve('src/content');

// Collections that carry og_title (exclude faqs which don't have og_title)
const COLLECTIONS = ['insights', 'library', 'use-cases', 'services', 'podcast'];

async function getMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
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
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: '', body: content, raw: '' };
  return { frontmatter: match[1], body: content.slice(match[0].length), raw: match[0] };
}

function getFrontmatterValue(frontmatter, key) {
  const re = new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm');
  const m = frontmatter.match(re);
  return m ? m[1].trim() : null;
}

function setFrontmatterValue(frontmatter, key, value) {
  // Insert og_image after og_title line
  if (frontmatter.includes(`${key}:`)) {
    // Update existing
    return frontmatter.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: "${value}"`);
  }
  // Insert after og_title
  return frontmatter.replace(
    /^(og_title:.*)$/m,
    `$1\nog_image: "${value}"`
  );
}

async function fetchOgImage(ogTitle) {
  const url = `${WORKER_URL}?title=${encodeURIComponent(ogTitle)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Worker returned ${res.status} for "${ogTitle}"`);
  const data = await res.json();
  if (!data.url) throw new Error(`Worker response missing "url" field for "${ogTitle}"`);
  return data.url;
}

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  const { frontmatter, body, raw } = parseFrontmatter(content);

  if (!frontmatter) return;

  const ogTitle = getFrontmatterValue(frontmatter, 'og_title');
  if (!ogTitle) return;

  const existing = getFrontmatterValue(frontmatter, 'og_image');
  if (existing) return; // already has OG image

  console.log(`[og-images] Generating image for: ${ogTitle}`);

  let imageUrl;
  try {
    imageUrl = await fetchOgImage(ogTitle);
  } catch (err) {
    console.error(`[og-images] Failed for ${filePath}: ${err.message}`);
    return;
  }

  const updatedFrontmatter = setFrontmatterValue(frontmatter, 'og_image', imageUrl);
  const updatedContent = `---\n${updatedFrontmatter}\n---${body}`;
  await writeFile(filePath, updatedContent, 'utf8');

  console.log(`[og-images] ✓ ${filePath} → ${imageUrl}`);
}

async function main() {
  let processed = 0;

  for (const collection of COLLECTIONS) {
    const collectionDir = join(CONTENT_ROOT, collection);
    let files;
    try {
      files = await getMarkdownFiles(collectionDir);
    } catch {
      continue; // collection dir might not exist yet
    }

    for (const file of files) {
      await processFile(file);
      processed++;
    }
  }

  console.log(`[og-images] Done. Checked ${processed} files.`);
}

main().catch(err => {
  console.error('[og-images] Fatal error:', err);
  process.exit(1);
});
