/**
 * Podcast RSS import script
 *
 * Fetches the podcast RSS feed and writes/updates Markdown files in
 * src/content/podcast/en/ for each episode.
 *
 * File naming: {episode_number}-{slugified-title}.md
 * e.g. 3-the-ego-trap-why-our-ideologies-keep-us-divided.md
 *
 * Existing files are never overwritten — only created if missing.
 * The summary field is left empty for generate-summaries.mjs to fill.
 *
 * Usage:
 *   node --env-file=.env scripts/import-podcast.mjs
 *
 * If PODCAST_RSS_URL is not set, the script exits cleanly (no-op).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RSS_URL = process.env.PODCAST_RSS_URL;

if (!RSS_URL) {
  console.log('[import-podcast] PODCAST_RSS_URL not set — skipping.');
  process.exit(0);
}

const PODCAST_DIR = resolve('src/content/podcast/en');

// ── XML helpers ──────────────────────────────────────────────────────────────

function xmlTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function xmlAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function xmlItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

function cdata(str) {
  if (!str) return '';
  return str.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseDate(rssDate) {
  try {
    const d = new Date(rssDate);
    if (isNaN(d)) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[–—]/g, '-')         // em/en dashes → hyphen
    .replace(/[^\w\s-]/g, '')      // remove special chars
    .replace(/[\s_]+/g, '-')       // spaces → hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens
}

function padEpisode(n) {
  return String(n).padStart(3, '0');
}

function formatDuration(raw) {
  if (!raw) return null;
  // Already in HH:MM:SS or MM:SS format
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return raw;
  // Seconds only — convert to HH:MM:SS
  const secs = parseInt(raw, 10);
  if (isNaN(secs)) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ── YAML helpers ─────────────────────────────────────────────────────────────

function yamlString(value) {
  if (value === null || value === undefined) return '""';
  // Numbers stay unquoted
  if (typeof value === 'number') return String(value);
  const str = String(value);
  if (str === '') return '""';
  // Use double quotes, escape internal double quotes
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildFrontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') continue;
    if (key === 'description') {
      // Block scalar for multiline description
      lines.push(`description: |`);
      for (const line of String(value).split('\n')) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push(`${key}: ${yamlString(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[import-podcast] Fetching RSS from ${RSS_URL}`);

  let xml;
  try {
    const res = await fetch(RSS_URL, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.error(`[import-podcast] Failed to fetch RSS: ${err.message}`);
    process.exit(1);
  }

  const items = xmlItems(xml);
  if (items.length === 0) {
    console.log('[import-podcast] No episodes found in feed.');
    process.exit(0);
  }

  console.log(`[import-podcast] Found ${items.length} episodes.`);

  if (!existsSync(PODCAST_DIR)) {
    await mkdir(PODCAST_DIR, { recursive: true });
  }

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const title = cdata(xmlTag(item, 'title'));
    if (!title) continue;

    const rawEpisode = xmlTag(item, 'itunes:episode');
    const episodeNumber = rawEpisode ? parseInt(rawEpisode, 10) : null;
    if (!episodeNumber) {
      console.warn(`[import-podcast] Skipping "${title}" — no itunes:episode number`);
      skipped++;
      continue;
    }

    // File naming: {episode_number}-{slugified-title}.md
    const filename = `${episodeNumber}-${slugify(title)}.md`;
    const filePath = join(PODCAST_DIR, filename);

    // Skip if already exists — never overwrite manual edits
    if (existsSync(filePath)) {
      console.log(`[import-podcast] Exists, skipping: ${filename}`);
      skipped++;
      continue;
    }

    // Parse all fields
    const date = parseDate(xmlTag(item, 'pubDate'));

    const rawDescription = cdata(xmlTag(item, 'description')) || cdata(xmlTag(item, 'itunes:summary')) || '';
    const description = stripHtml(rawDescription);

    const duration = formatDuration(xmlTag(item, 'itunes:duration'));

    const audioUrl = xmlAttr(item, 'enclosure', 'url') || '';

    // GUID as episode_id
    const episodeId = cdata(xmlTag(item, 'guid')) || '';

    // Episode artwork — itunes:image href attr
    const artworkUrl = xmlAttr(item, 'itunes:image', 'href') || '';

    // OG image path — /podcast-artwork/ep-{padded}.jpg
    const ogImage = `/podcast-artwork/ep-${padEpisode(episodeNumber)}.jpg`;

    // Category from itunes:category
    const rawCategory = xmlAttr(item, 'itunes:category', 'text') || 'Solo Episode';

    const fields = {
      title,
      og_title: title,           // override manually when shorter title needed
      date,
      episode_number: episodeNumber,
      category: rawCategory,
      status: 'draft',
      duration,
      audio_url: audioUrl,
      episode_id: episodeId,
      artwork_url: artworkUrl,
      description,
      og_image: ogImage,
      summary: '',               // filled by generate-summaries.mjs
    };

    // Remove null/empty optional fields
    if (!fields.duration) delete fields.duration;
    if (!fields.audio_url) delete fields.audio_url;
    if (!fields.episode_id) delete fields.episode_id;
    if (!fields.artwork_url) delete fields.artwork_url;

    const content = buildFrontmatter(fields) + '\n<!-- Add transcript here -->\n';
    await writeFile(filePath, content, 'utf8');
    console.log(`[import-podcast] Created: ${filename}`);
    created++;
  }

  console.log(`[import-podcast] Done. ${created} created, ${skipped} skipped.`);
}

main().catch(err => {
  console.error('[import-podcast] Fatal error:', err);
  process.exit(1);
});