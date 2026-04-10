/**
 * Podcast RSS import script
 *
 * Fetches the podcast RSS feed and writes/updates Markdown files in
 * src/content/podcast/en/ for each episode. Existing files are not
 * overwritten if they already have a manual transcript body — only
 * frontmatter fields sourced from RSS are updated.
 *
 * Usage:
 *   node scripts/import-podcast.mjs
 *   PODCAST_RSS_URL=https://feeds.example.com/podcast node scripts/import-podcast.mjs
 *
 * If PODCAST_RSS_URL is not set, the script exits cleanly (no-op).
 *
 * Field mapping:
 *   RSS <title>              → frontmatter title
 *   RSS <pubDate>            → frontmatter date (ISO 8601)
 *   RSS <itunes:episode>     → frontmatter episode_number
 *   RSS <description>        → frontmatter summary (stripped of HTML)
 *   RSS <itunes:summary>     → frontmatter summary (fallback)
 *   RSS <link>               → used to derive Spotify/YouTube URLs if matched
 *   RSS <enclosure url>      → audio URL (stored as comment, not a schema field)
 *   Custom <spotify:url>     → frontmatter spotify_url (if present in feed)
 *   Custom <itunes:type>     → frontmatter category
 *
 * Slug is derived from episode_number: e{episode_number} (e.g. e012).
 * This ensures stable filenames even if the episode title changes.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RSS_URL = process.env.PODCAST_RSS_URL;

if (!RSS_URL) {
  console.log('[import-podcast] PODCAST_RSS_URL not set — skipping podcast import.');
  process.exit(0);
}

const PODCAST_DIR = resolve('src/content/podcast/en');

// ── XML helpers ──────────────────────────────────────────────────────────────

function xmlTag(xml, tag) {
  // Handles both <tag>value</tag> and namespaced <ns:tag>value</ns:tag>
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
  while ((m = re.exec(xml)) !== null) {
    items.push(m[1]);
  }
  return items;
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

function cdata(str) {
  // Strip CDATA wrappers
  return str ? str.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() : str;
}

function parseDate(rssDate) {
  try {
    const d = new Date(rssDate);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return null;
  }
}

function toSlug(episodeNumber) {
  const n = String(episodeNumber).padStart(3, '0');
  return `e${n}`;
}

function guessCategory(item) {
  const type = xmlTag(item, 'itunes:episodeType') || xmlTag(item, 'itunes:type');
  if (!type) return 'Solo Episode';
  const t = type.toLowerCase();
  if (t.includes('interview') || t.includes('guest')) return 'Interview';
  if (t.includes('case') || t.includes('story')) return 'Case Study';
  return 'Solo Episode';
}

// ── Frontmatter helpers ──────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n?)([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };
  const fm = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { fm, body: match[3] };
}

function fmValue(value) {
  if (value === null || value === undefined) return '""';
  const s = String(value);
  // Quote strings that contain special YAML characters
  if (/[:#\[\]{}&*!,|>?]/.test(s) || s.includes('\n') || s.startsWith(' ') || s.endsWith(' ')) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function buildFrontmatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${fmValue(v)}`);
  return `---\n${lines.join('\n')}\n---\n`;
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
    console.log('[import-podcast] No episodes found in RSS feed.');
    process.exit(0);
  }

  console.log(`[import-podcast] Found ${items.length} episodes.`);

  if (!existsSync(PODCAST_DIR)) {
    await mkdir(PODCAST_DIR, { recursive: true });
  }

  let written = 0;
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

    const slug = toSlug(episodeNumber);
    const filePath = join(PODCAST_DIR, `${slug}.md`);

    const rawDate = xmlTag(item, 'pubDate');
    const date = parseDate(rawDate) || new Date().toISOString().slice(0, 10);

    // Summary: prefer itunes:summary, fall back to description, strip HTML
    const rawSummary = cdata(xmlTag(item, 'itunes:summary')) || cdata(xmlTag(item, 'description')) || '';
    const summary = stripHtml(rawSummary).slice(0, 500);

    // og_title: truncate title if too long
    const ogTitle = title.length > 70 ? title.slice(0, 67) + '…' : title;

    // Spotify URL: check for spotify:url custom tag or infer from link
    let spotifyUrl = xmlTag(item, 'spotify:url') || '';
    if (!spotifyUrl) {
      const link = cdata(xmlTag(item, 'link'));
      if (link && link.includes('spotify')) spotifyUrl = link;
    }

    const category = guessCategory(item);

    // Check if file already exists
    if (existsSync(filePath)) {
      const existing = await readFile(filePath, 'utf8');
      const { fm, body } = parseFrontmatter(existing);

      // Only update RSS-sourced fields; preserve manual edits (transcript body)
      const updated = {
        title: title,
        date: fm.date || date,
        episode_number: episodeNumber,
        summary: fm.summary || summary,
        og_title: fm.og_title || ogTitle,
        spotify_url: fm.spotify_url || spotifyUrl || '',
        youtube_url: fm.youtube_url || '',
        category: fm.category || category,
        status: fm.status || 'draft',
      };

      // Remove empty optional fields
      if (!updated.youtube_url) delete updated.youtube_url;
      if (!updated.spotify_url) delete updated.spotify_url;

      const newContent = buildFrontmatter(updated) + (body || '\n');
      const oldContent = existing;

      if (newContent === oldContent) {
        skipped++;
        continue;
      }

      await writeFile(filePath, newContent, 'utf8');
      console.log(`[import-podcast] Updated: ${slug}.md`);
    } else {
      // New file — create with empty transcript body
      const fields = {
        title,
        date,
        episode_number: episodeNumber,
        summary,
        og_title: ogTitle,
        category,
        status: 'draft',
      };

      if (spotifyUrl) fields.spotify_url = spotifyUrl;

      const content = buildFrontmatter(fields) + '\n<!-- Paste transcript here -->\n';
      await writeFile(filePath, content, 'utf8');
      console.log(`[import-podcast] Created: ${slug}.md`);
    }

    written++;
  }

  console.log(`[import-podcast] Done. ${written} written, ${skipped} unchanged/skipped.`);
}

main().catch(err => {
  console.error('[import-podcast] Fatal error:', err);
  process.exit(1);
});
