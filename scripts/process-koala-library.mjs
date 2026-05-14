/**
 * process-koala-library.mjs
 *
 * Reads Koala AI source files, rewrites each in André Daus's voice via Claude API,
 * extracts metadata, and writes formatted library entries to src/content/library/en/.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/process-koala-library.mjs [options]
 *
 * Options:
 *   --dry-run     List files to process without calling API or writing output
 *   --limit N     Process only the first N eligible files
 *   --force       Overwrite files that already exist in the library
 *   --from SLUG   Start from this slug (alphabetical — useful for resuming)
 *   --only SLUG   Process only this one slug (for testing)
 *
 * Progress is tracked in scripts/.koala-progress.json so interrupted runs resume.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { request } from 'node:https';

function httpsPost(url, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const u = new URL(url);
    const req = request(
      { hostname: u.hostname, path: u.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`API error ${res.statusCode}: ${data}`));
          else resolve(JSON.parse(data));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Load .env if present (for local runs without shell env var)
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath) && !process.env.ANTHROPIC_API_KEY) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^ANTHROPIC_API_KEY=(.+)/);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].trim();
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const koalaDir = '/Users/andredaus/Library/Mobile Documents/iCloud~md~obsidian/Documents/Second Brain/10-Content/Blog-Posts/Koala';
const outputDir = resolve(projectRoot, 'src/content/library/en');
const progressFile = resolve(__dirname, '.koala-progress.json');

// ─── Skip list ────────────────────────────────────────────────────────────────
// Files that are insights articles, German content, or pillar content
// delivered separately — not library entries.
const SKIP_SLUGS = new Set([
  'add-value',
  'climate-change-and-environmental-sustainability',
  'contrarian-thinker',
  'creative-thinking',
  'critical-thinking',
  'cultural-empathy',
  'curse-of-knowledge-cognitive-bias',   // duplicate of curse-of-knowledge
  'donald-trump-learnings',
  'group-thinking-and-decision-support',
  'neue-wege-entdecken',
  'past-and-future',
  'red-teaming',
  'regulatory-compliance-and-legal-challenges',
  'rethinking-climate-change-why-traditional-sustainability-efforts-are-failing-our-urban-environments',
  'selfawareness-and-reflection',
  'selfconfidence-and-reflection',
  'what-is-the-problem',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yamlStr(value) {
  if (typeof value !== 'string') return String(value);
  const needsQuotes = /[:#\[\]{},|>&*!'"@%\n]/.test(value)
    || value.startsWith(' ') || value.endsWith(' ')
    || value.trim() !== value;
  if (!needsQuotes) return value;
  // prefer double quotes; escape internal double quotes
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function yamlList(arr) {
  if (!arr || arr.length === 0) return '[]';
  return '\n' + arr.map(s => `  - ${yamlStr(s)}`).join('\n');
}

function buildFrontmatter(f) {
  const lines = ['---'];
  lines.push(`title: ${yamlStr(f.title)}`);
  lines.push(`type: ${f.type}`);
  lines.push(`definition: ${yamlStr(f.definition)}`);
  if (f.og_title) lines.push(`og_title: ${yamlStr(f.og_title)}`);
  if (f.summary)  lines.push(`summary: ${yamlStr(f.summary)}`);
  if (f.first_described) lines.push(`first_described: ${yamlStr(f.first_described)}`);
  if (f.applies_to) lines.push(`applies_to: ${yamlStr(f.applies_to)}`);
  if (f.risk_level) lines.push(`risk_level: ${yamlStr(f.risk_level)}`);
  if (f.tags && f.tags.length)  lines.push(`tags:${yamlList(f.tags)}`);
  if (f.related_entries && f.related_entries.length) lines.push(`related_entries:${yamlList(f.related_entries)}`);
  lines.push('---');
  return lines.join('\n');
}

function loadProgress() {
  if (existsSync(progressFile)) {
    try { return new Set(JSON.parse(readFileSync(progressFile, 'utf-8'))); }
    catch { return new Set(); }
  }
  return new Set();
}

function saveProgress(set) {
  writeFileSync(progressFile, JSON.stringify([...set], null, 2), 'utf-8');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── System prompt (voice + format spec) ─────────────────────────────────────

const SYSTEM_PROMPT = `You are writing library reference entries for André Daus's website (andredaus.com). André is a Strategic Opposition consultant — his methodology is structured adversarial challenge: identifying the unchallenged assumptions inside strategies and organisations before the market exposes them.

## André's Voice

Write with these characteristics:

- **Declarative.** Short sentences that make direct statements. No hedging language ("may", "might", "some would argue", "it is important to note").
- **Opens without preamble.** The first sentence of the body is substantive. No "In this entry we will explore...".
- **Strategic/organisational framing.** Every entry is written for leaders, founders, and decision-makers, not psychology students. Connect to how this shows up in strategy rooms, hiring decisions, boardrooms, competitive assessments.
- **Real named examples.** Cite specific named experiments, events, or researchers where they exist (Milgram, Kahneman, Wason, the 2008 financial crisis, etc.). Don't invent citations, but use known real ones.
- **Prose over bullets.** Prefer continuous paragraphs. Bullet lists only when genuinely listing items.
- **No tables.**
- **Diagnosis before prescription.** Explain the failure mode before offering the correction.
- **Short punchy sentences after longer explanations.** "That isn't clarity. That's silence."
- **Connects to Strategic Opposition.** The "How to Counteract" or equivalent section frames external adversarial challenge as the structural solution — not willpower or awareness alone.
- **Ends with a diagnostic question.** A sharp, specific question that readers can apply immediately.
- **Further Reading.** 3-4 real published works (books or named journal articles) at the end.

## Example Entry (voice reference)

Title: Authority Bias

Body excerpt:
"""
We don't evaluate opinions in a vacuum. We evaluate them through whoever's delivering them — and if that person carries a title, a credential, or a uniform, our critical thinking quietly steps aside.

That's authority bias: attributing greater accuracy to an opinion based on the perceived status of the source, regardless of the actual content or relevance of that opinion.

## How It Works

The mechanism is simple: the brain uses source as a proxy for credibility. If someone looks or sounds authoritative — lab coat, impressive title, institutional affiliation, confident tone — we lower our threshold for scrutiny. We're not consciously choosing to do this. It happens upstream of deliberate thought.

Stanley Milgram's obedience experiments made this viscerally clear. Participants administered what they believed were dangerous electric shocks to strangers, simply because a researcher in a lab coat told them to continue. 65% went all the way to the maximum. When the same instructions came from someone without the coat, compliance dropped to 20%.

## Why It's a Problem in Practice

More often, authority bias operates as a suppression mechanism — it stops people from raising valid concerns. Junior employees stay quiet in meetings. Engineers defer to executives on architecture decisions that the executives aren't qualified to make. In organisations, this shows up as a tax on information flow. The CEO voices a direction and the room aligns — not because the argument was strong, but because no one wants to be the person who challenged it.

## The Diagnostic Question

When you find yourself accepting a recommendation with more confidence than the underlying evidence warrants, ask: *Am I convinced by this argument, or am I convinced by who's making it?*
"""

## Output Format

Return a single JSON object (no markdown code fences, just raw JSON) with exactly these fields:

{
  "title": "Human-readable title (e.g. 'Anchoring Bias', not a slug)",
  "type": "bias" | "structure" | "method",
  "definition": "One crisp sentence. What it is, precisely. No hedging.",
  "og_title": "Short SEO title variant (omit 'André Daus', 5-8 words max)",
  "summary": "One sentence: the strategic significance of this entry — why it matters to decision-makers.",
  "first_described": "Researcher, Year — e.g. 'Tversky & Kahneman, 1974'. Null if unknown.",
  "applies_to": "Who this affects, specifically. E.g. 'Leaders, analysts, and teams under time pressure'. Null if very broad.",
  "risk_level": "One phrase: severity and character. E.g. 'High — amplifies under expertise', 'Moderate — visible with hindsight'. Null if not applicable.",
  "tags": ["3-6 relevant tags from: Decision-making, Strategy, Leadership, Research, Communication, Negotiation, Hiring, Risk, Finance, Teams, Psychology, Technology"],
  "related_entries": ["3-5 library entry slugs that are genuinely connected — use lowercase-kebab-case of the bias/method name"],
  "body": "Full markdown body. 4-6 sections. 600-900 words. No frontmatter. Include '## Further Reading' at end with 3-4 real sources."
}

The 'type' field:
- "bias": a cognitive or organisational bias or fallacy
- "method": an analytical technique or framework (pre-mortem, red teaming, Occam's razor, etc.)
- "structure": a facilitation or collaborative thinking structure

Do not include 'in_practice' — that field is populated separately.
Do not invent citations. Only include real, verifiable sources in Further Reading.
`;

// ─── API call ─────────────────────────────────────────────────────────────────

async function callClaude(sourceContent, slug) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const userMessage = `Convert the following source content into a library entry for andredaus.com.

Source slug: ${slug}
Source content:
---
${sourceContent.slice(0, 8000)}
---

Return only the JSON object. No markdown fences, no explanation.`;

  const data = await httpsPost(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model: 'claude-sonnet-4-6', max_tokens: 2500, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }] }
  );

  const text = data.content?.[0]?.text ?? '';

  // Parse JSON — handle both raw and fenced
  const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/) ?? [null, text];
  const raw = (jsonMatch[1] ?? text).trim();

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`JSON parse failed for ${slug}. Raw:\n${raw.slice(0, 500)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force  = args.includes('--force');
const limitArg = args.indexOf('--limit');
const limit  = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : Infinity;
const fromArg  = args.indexOf('--from');
const fromSlug = fromArg >= 0 ? args[fromArg + 1] : null;
const onlyArg  = args.indexOf('--only');
const onlySlug = onlyArg >= 0 ? args[onlyArg + 1] : null;

// Collect eligible files
const allFiles = readdirSync(koalaDir)
  .filter(f => f.endsWith('.md') && !f.includes(' (')) // skip variants with ' ('
  .map(f => ({ file: f, slug: f.replace(/\.md$/, '') }))
  .filter(({ slug }) => !SKIP_SLUGS.has(slug))
  .sort((a, b) => a.slug.localeCompare(b.slug));

// Apply --only
const filtered = onlySlug
  ? allFiles.filter(({ slug }) => slug === onlySlug)
  : allFiles;

// Apply --from
const started = fromSlug
  ? filtered.filter(({ slug }) => slug >= fromSlug)
  : filtered;

const progress = loadProgress();

// Build work list
const workList = started.filter(({ slug }) => {
  const outputPath = resolve(outputDir, `${slug}.md`);
  if (progress.has(slug) && !force) return false;       // already done
  if (existsSync(outputPath) && !force) return false;   // already written
  return true;
}).slice(0, limit);

console.log(`\nKoala Library Processor`);
console.log(`  Source  : ${koalaDir}`);
console.log(`  Output  : ${outputDir}`);
console.log(`  Eligible: ${allFiles.length} files after skip list`);
console.log(`  To process: ${workList.length} files${dryRun ? ' (DRY RUN)' : ''}`);
console.log('');

if (dryRun) {
  workList.forEach(({ slug }) => console.log(`  [ ] ${slug}`));
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable not set.');
  console.error('Run with: ANTHROPIC_API_KEY=sk-ant-... node scripts/process-koala-library.mjs');
  process.exit(1);
}

let done = 0, errors = 0;

for (const { file, slug } of workList) {
  const sourcePath = resolve(koalaDir, file);
  const outputPath = resolve(outputDir, `${slug}.md`);

  process.stdout.write(`[${done + 1}/${workList.length}] ${slug} ... `);

  try {
    const source = readFileSync(sourcePath, 'utf-8');
    const result = await callClaude(source, slug);

    // Validate required fields
    if (!result.title || !result.type || !result.definition || !result.body) {
      throw new Error(`Missing required fields in API response`);
    }
    if (!['bias', 'structure', 'method'].includes(result.type)) {
      throw new Error(`Invalid type: ${result.type}`);
    }

    const frontmatter = buildFrontmatter({
      title:           result.title,
      type:            result.type,
      definition:      result.definition,
      og_title:        result.og_title || null,
      summary:         result.summary || null,
      first_described: result.first_described || null,
      applies_to:      result.applies_to || null,
      risk_level:      result.risk_level || null,
      tags:            result.tags || [],
      related_entries: result.related_entries || [],
    });

    const content = `${frontmatter}\n\n${result.body.trim()}\n`;
    writeFileSync(outputPath, content, 'utf-8');
    progress.add(slug);
    saveProgress(progress);
    done++;
    console.log('✓');
  } catch (err) {
    errors++;
    console.log(`✗  ${err.message}`);
  }

  // Respectful rate limiting
  if (done + errors < workList.length) await sleep(600);
}

console.log(`\nDone: ${done} written, ${errors} errors`);
if (errors > 0) {
  console.log('Re-run the same command to retry failed entries (progress was saved for successful ones).');
}
