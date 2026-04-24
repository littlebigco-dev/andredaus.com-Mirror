/**
 * scripts/podcast-artwork.mjs
 *
 * Downloads episode artwork for podcast episodes:
 *   1. Episode artwork from `artwork_url` (Anchor/Spotify CDN)
 *   2. YouTube thumbnail from `youtube_url` (if present)
 *
 * Images are saved to public/podcast-artwork/ and the frontmatter
 * `og_image` field is updated to the local path so Astro can serve it.
 *
 * Usage:
 *   node scripts/podcast-artwork.mjs
 *   node scripts/podcast-artwork.mjs --dry-run
 *   node scripts/podcast-artwork.mjs --force    (re-download existing)
 *
 * No external dependencies — uses Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../src/content/podcast/en');
const ARTWORK_DIR = path.resolve(__dirname, '../public/podcast-artwork');
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// ── Frontmatter helpers ───────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

function getField(yaml, field) {
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
  const singleLine = new RegExp(`^${field}:.*$`, 'm');

  if (singleLine.test(yaml)) {
    return yaml.replace(singleLine, newLine);
  }
  return yaml + `\n${newLine}`;
}

// ── Download helpers ──────────────────────────────────────────────────

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    const request = client.get(url, response => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return download(response.headers.location, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }

      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    });

    request.on('error', err => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });

    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

function youtubeVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function youtubeThumbnailUrl(videoId) {
  // Try maxresdefault first; fall back to hqdefault if it 404s
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function youtubeThumbnailFallback(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  if (!DRY_RUN) {
    fs.mkdirSync(ARTWORK_DIR, { recursive: true });
    fs.mkdirSync(path.join(ARTWORK_DIR, 'youtube'), { recursive: true });
  }

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  console.log(`Found ${files.length} episode files`);
  console.log(`Artwork → ${ARTWORK_DIR}`);
  if (DRY_RUN) console.log('DRY RUN — no files will be written\n');

  let artworkDone = 0;
  let youtubeDone = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      console.warn(`⚠  Could not parse frontmatter: ${file}`);
      continue;
    }

    const epNum = getField(parsed.yaml, 'episode_number');
    const artworkUrl = getField(parsed.yaml, 'artwork_url');
    const youtubeUrl = getField(parsed.yaml, 'youtube_url');
    const ogImage = getField(parsed.yaml, 'og_image');

    const baseName = `ep-${String(epNum).padStart(3, '0')}`;
    let yamlUpdated = parsed.yaml;
    let dirty = false;

    // ── 1. Episode artwork (Anchor/Spotify CDN) ────────────────────────

    if (artworkUrl) {
      const ext = artworkUrl.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i)?.[1] ?? 'jpg';
      const artworkFilename = `${baseName}.${ext}`;
      const artworkDest = path.join(ARTWORK_DIR, artworkFilename);
      const artworkPublicPath = `/podcast-artwork/${artworkFilename}`;

      const alreadyExists = fs.existsSync(artworkDest);

      if (!alreadyExists || FORCE) {
        process.stdout.write(`  artwork  ep-${epNum} … `);
        if (!DRY_RUN) {
          try {
            await download(artworkUrl, artworkDest);
            console.log(`✓ ${artworkFilename}`);
            artworkDone++;
          } catch (err) {
            console.error(`✗ ${err.message}`);
            errors++;
          }
        } else {
          console.log(`(would download → ${artworkFilename})`);
          artworkDone++;
        }
      } else {
        skipped++;
      }

      // Update og_image in frontmatter if not already set to a local path
      if (!ogImage || ogImage.startsWith('http')) {
        yamlUpdated = setField(yamlUpdated, 'og_image', artworkPublicPath);
        dirty = true;
      }
    }

    // ── 2. YouTube thumbnail ───────────────────────────────────────────

    if (youtubeUrl) {
      const videoId = youtubeVideoId(youtubeUrl);
      if (videoId) {
        const ytFilename = `${baseName}-youtube.jpg`;
        const ytDest = path.join(ARTWORK_DIR, 'youtube', ytFilename);
        const ytPublicPath = `/podcast-artwork/youtube/${ytFilename}`;
        const alreadyExists = fs.existsSync(ytDest);

        if (!alreadyExists || FORCE) {
          process.stdout.write(`  youtube  ep-${epNum} … `);
          if (!DRY_RUN) {
            try {
              // Try maxresdefault first
              try {
                await download(youtubeThumbnailUrl(videoId), ytDest);
              } catch {
                await download(youtubeThumbnailFallback(videoId), ytDest);
              }
              console.log(`✓ ${ytFilename}`);

              // Set youtube thumbnail as og_image if it's the better image (prefer YouTube for video episodes)
              yamlUpdated = setField(yamlUpdated, 'og_image', ytPublicPath);
              dirty = true;
              youtubeDone++;
            } catch (err) {
              console.error(`✗ ${err.message}`);
              errors++;
            }
          } else {
            console.log(`(would download → ${ytFilename})`);
            youtubeDone++;
          }
        } else {
          skipped++;
        }
      }
    }

    // ── Write updated frontmatter ─────────────────────────────────────

    if (dirty && !DRY_RUN) {
      const updatedContent = `---\n${yamlUpdated}\n---\n${parsed.body}`;
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
    }
  }

  console.log(`
Done.
  Episode artwork downloaded : ${artworkDone}
  YouTube thumbnails downloaded: ${youtubeDone}
  Skipped (already exist)    : ${skipped}
  Errors                     : ${errors}
`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
