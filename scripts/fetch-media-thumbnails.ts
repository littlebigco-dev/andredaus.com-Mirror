/**
 * scripts/fetch-media-thumbnails.ts
 *
 * Downloads YouTube thumbnails and podcast episode artwork at build time,
 * storing them in src/assets/media/thumbnails/ for Astro's <Image> component.
 *
 * Run manually:   npx tsx scripts/fetch-media-thumbnails.ts
 *
 * package.json hooks:
 *   "fetch:media": "tsx scripts/fetch-media-thumbnails.ts",
 *   "prebuild":    "tsx scripts/fetch-media-thumbnails.ts",
 *   "predev":      "tsx scripts/fetch-media-thumbnails.ts"
 *
 * Peer deps:  npm install -D tsx gray-matter
 *
 * ── Frontmatter keys read ────────────────────────────────────────────────────
 *
 *   episode_id:   "11c0f107-937f-44f2-bc13-54547e4a79d6"
 *                 RSS <guid> — used as artwork filename. Stable across rebuilds.
 *                 Pass this as artworkId prop to <SpotifyPlayer>.
 *
 *   artwork_url:  "https://d3t3ozftmdmh3i.cloudfront.net/..."
 *                 <itunes:image href> from RSS. Downloaded and saved locally.
 *
 *   spotify_url:  "https://open.spotify.com/episode/..."
 *                 Episode page URL for the embed. If absent or unresolvable,
 *                 the player falls back to an external link.
 *
 *   youtube_url:  "https://www.youtube.com/watch?v=..."
 *                 Thumbnail downloaded from img.youtube.com.
 *
 * ── Artwork filename priority ────────────────────────────────────────────────
 *
 *   1. episode_id field  (RSS GUID — recommended for cron-imported episodes)
 *   2. Spotify episode ID extracted from spotify_url
 *   3. Content file slug (filename without extension)
 */

import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, extname, basename }                      from 'node:path';
import { fileURLToPath }                                from 'node:url';
import matter                                           from 'gray-matter';

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT        = fileURLToPath(new URL('..', import.meta.url));
const CONTENT_DIR = join(ROOT, 'src', 'content');
const OUTPUT_DIR  = join(ROOT, 'src', 'assets', 'media', 'thumbnails');

// ── YouTube ───────────────────────────────────────────────────────────────────

const YT_RESOLUTIONS = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'] as const;

function ytVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    return (
      u.searchParams.get('v') ??
      url.match(/youtu\.be\/([^?&/]+)/)?.[1] ??
      url.match(/\/embed\/([^?&/]+)/)?.[1] ??
      null
    );
  } catch { return null; }
}

async function fetchYouTubeThumbnail(videoId: string): Promise<{
  saved: boolean; skipped?: boolean; resolution?: string;
}> {
  const dest = join(OUTPUT_DIR, `${videoId}.jpg`);
  if (await fileExists(dest)) return { saved: false, skipped: true };
  for (const res of YT_RESOLUTIONS) {
    const url = `https://img.youtube.com/vi/${videoId}/${res}.jpg`;
    if (await downloadFile(url, dest)) return { saved: true, resolution: res };
  }
  return { saved: false };
}

// ── Spotify ───────────────────────────────────────────────────────────────────

/** Extract episode ID from open.spotify.com or embed.spotify.com URLs only. */
function spotifyEpisodeId(url: string): string | null {
  if (!url.includes('spotify.com')) return null;
  // Reject audio stream / Anchor.fm / Cloudfront URLs
  if (!url.includes('open.spotify.com') && !url.includes('embed.spotify.com')) return null;
  return url.match(/spotify\.com\/(?:embed\/)?[a-z]+\/([a-zA-Z0-9]+)/)?.[1] ?? null;
}

// ── Download helpers ──────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; }
  catch { return false; }
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) return false;  // reject YouTube's 1×1 placeholder
    await writeFile(dest, buf);
    return true;
  } catch { return false; }
}

async function fetchArtwork(
  artworkUrl: string,
  id: string,
): Promise<{ saved: boolean; skipped?: boolean }> {
  const ext  = extname(new URL(artworkUrl).pathname).toLowerCase() || '.jpg';
  const dest = join(OUTPUT_DIR, `${id}${ext}`);
  if (await fileExists(dest)) return { saved: false, skipped: true };
  return { saved: await downloadFile(artworkUrl, dest) };
}

// ── Content scanner ───────────────────────────────────────────────────────────

interface Entry {
  file:        string;
  slug:        string;
  title:       string;
  episodeId?:  string;   // RSS GUID — preferred artwork filename
  spotifyUrl?: string;
  artworkUrl?: string;
  youtubeUrl?: string;
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory())                  yield* walkDir(full);
    else if (/\.(md|mdx)$/.test(e.name))  yield full;
  }
}

async function scanContent(): Promise<Entry[]> {
  const results: Entry[] = [];

  for await (const file of walkDir(CONTENT_DIR)) {
    const { data } = matter(await readFile(file, 'utf-8'));

    const episodeId  = data.episode_id  ?? null;
    const spotifyUrl = data.spotify_url ?? null;
    const artworkUrl = data.artwork_url ?? null;
    const youtubeUrl = data.youtube_url ??
      (data.youtube?.videoId
        ? `https://www.youtube.com/watch?v=${data.youtube.videoId}`
        : null);

    if (episodeId || spotifyUrl || artworkUrl || youtubeUrl) {
      results.push({
        file,
        slug:       basename(file, extname(file)),
        title:      String(data.title ?? basename(file)),
        episodeId:  episodeId  ?? undefined,
        spotifyUrl: spotifyUrl ?? undefined,
        artworkUrl: artworkUrl ?? undefined,
        youtubeUrl: youtubeUrl ?? undefined,
      });
    }
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log('\n▸ fetch-media-thumbnails — scanning content…\n');
  const entries = await scanContent();

  if (entries.length === 0) {
    console.log('  Nothing found. Content files need at least one of:');
    console.log('    episode_id, spotify_url, artwork_url, youtube_url\n');
    return;
  }

  console.log(`  Found ${entries.length} file(s) with media.\n`);

  let downloaded = 0, skipped = 0, failed = 0;

  for (const entry of entries) {

    // ── Podcast artwork ───────────────────────────────────────────────────────
    if (entry.artworkUrl) {
      // Artwork filename priority: episode_id → Spotify ID → slug
      const artworkId =
        entry.episodeId ??
        (entry.spotifyUrl ? (spotifyEpisodeId(entry.spotifyUrl) ?? null) : null) ??
        entry.slug;

      const idSource =
        entry.episodeId                                          ? 'guid'    :
        (entry.spotifyUrl && spotifyEpisodeId(entry.spotifyUrl)) ? 'spotify' :
                                                                   'slug';

      process.stdout.write(`  artwork  [${idSource}:${artworkId}]  ${entry.title}  `);
      const r = await fetchArtwork(entry.artworkUrl, artworkId);
      if (r.skipped)    { console.log('→ cached');  skipped++;    }
      else if (r.saved)  { console.log('→ saved');   downloaded++; }
      else               { console.log('→ FAILED');  failed++;     }

    } else if (entry.spotifyUrl || entry.episodeId) {
      const id = entry.episodeId ?? (entry.spotifyUrl ? spotifyEpisodeId(entry.spotifyUrl) : null) ?? entry.slug;
      console.log(`  artwork  [${id}]  ${entry.title}  → no artwork_url, skipped`);
    }

    // ── YouTube thumbnail ─────────────────────────────────────────────────────
    if (entry.youtubeUrl) {
      const vid = ytVideoId(entry.youtubeUrl);
      if (vid) {
        process.stdout.write(`  youtube  [${vid}]  ${entry.title}  `);
        const r = await fetchYouTubeThumbnail(vid);
        if (r.skipped)    { console.log('→ cached');              skipped++;    }
        else if (r.saved)  { console.log(`→ saved (${r.resolution})`); downloaded++; }
        else               { console.log('→ FAILED');              failed++;     }
      } else {
        console.log(`  youtube  [?]  ${entry.title}  → could not extract video ID from: ${entry.youtubeUrl}`);
      }
    }
  }

  console.log(`\n  ✓ ${downloaded} downloaded   ${skipped} cached   ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('\nfetch-media-thumbnails error:', err);
  process.exitCode = 1;
});
