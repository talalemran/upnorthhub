/**
 * fetch-article-images.mjs
 * --------------------------------------------------------------
 * For every post in src/content/posts:
 *   1. Derives one keyword query per <h2> heading's text (sanitized; falls
 *      back to tags/title when a heading is too generic to match anything).
 *   2. Fetches photos from the Pixabay API (ranked by tag overlap).
 *   3. Downloads + compresses each to WebP (max width 1200, quality 90)
 *      and saves to public/images/articles/<slug>/imgN.webp.
 *   4. Injects <img> tags (alt, width, height, loading="lazy") into the
 *      markdown directly under the <h2> heading each image was queried from.
 *
 * Idempotent + top-up: if a post already has 3 injected images it is skipped;
 * if it has fewer, the existing injected images are stripped and rebuilt to 3.
 *
 * Requires: PIXABAY_API_KEY in .env or environment.
 * Run: node scripts/fetch-article-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Minimal .env loader (no extra dependency).
function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const API_KEY = process.env.PIXABAY_API_KEY;
if (!API_KEY) {
  console.error('✗ Missing PIXABAY_API_KEY. Add it to .env and re-run.');
  process.exit(1);
}

const force = !!process.env.FORCE;

const POSTS_DIR = path.join(root, 'src/content/posts');
const IMG_BASE = path.join(root, 'public/images/articles');
const MAX_WIDTH = 1200;
const QUALITY = 90;
const IMAGES_PER_ARTICLE = 3;

// Content hashes of every image used this run, so the same photo is never
// repeated within an article OR across the whole site.
const globalHashes = new Set();

/* ----------------------------- helpers ----------------------------- */

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { fm: '', body: raw };
  return { fm: m[1], body: raw.slice(m[0].length) };
}

function getField(fm, name) {
  const line = fm.split('\n').find((l) => l.startsWith(`${name}:`));
  if (!line) return '';
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

function getArrayField(fm, name) {
  const line = fm.split('\n').find((l) => l.startsWith(`${name}:`));
  if (!line) return [];
  const arr = line.slice(name.length + 1).trim().match(/\[([\s\S]*)\]/);
  if (!arr) return [];
  return arr[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function sanitize(q) {
  return q
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Map our content categories to Pixabay's category param to bias results.
const PIXABAY_CAT = {
  'e-commerce': 'business',
  'gig-work': 'business',
  'tools': 'science',
  'content-creation': 'education',
};

const STOP = new Set([
  'with', 'from', 'your', 'for', 'the', 'and', 'how', 'what', 'why', 'best',
  'guide', '2026', 'into', 'that', 'this', 'are', 'you', 'use', 'using',
  'create', 'creating', 'successful', 'beginners', 'choice', 'still',
  'platform', 'work', 'writing', 'business',
]);

function tokenize(q) {
  return sanitize(q)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// Score a Pixabay hit by how many query keywords appear in its tags.
function scoreHit(hit, tokens) {
  let s = 0;
  for (const t of tokens) {
    if (hit.tags.includes(t)) s += 2;
    else if (hit.tags.some((tg) => tg.includes(t) || t.includes(tg))) s += 1;
  }
  return s;
}

async function searchPixabay(query, pixCat) {
  const q = sanitize(query);
  if (!q) return [];
  let url =
    'https://pixabay.com/api/?key=' +
    encodeURIComponent(API_KEY) +
    '&q=' +
    encodeURIComponent(q) +
    '&image_type=photo&orientation=horizontal&safesearch=true&per_page=20&lang=en';
  if (pixCat) url += '&category=' + encodeURIComponent(pixCat);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay API ${res.status}`);
  const json = await res.json();
  return (json.hits || [])
    .map((h) => ({
      url: h.largeImageURL || h.webformatURL,
      tags: (h.tags || '')
        .toLowerCase()
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }))
    .filter((h) => h.url);
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function hashBuffer(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

async function compressBuffer(buf) {
  const meta = await sharp(buf).metadata();
  const resizeWidth = Math.min(meta.width || MAX_WIDTH, MAX_WIDTH);
  const outBuf = await sharp(buf)
    .resize({ width: resizeWidth, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  const outMeta = await sharp(outBuf).metadata();
  return { outBuf, width: outMeta.width, height: outMeta.height };
}

function countInjected(body, slug) {
  return (body.match(new RegExp(`/images/articles/${slug}/`, 'g')) || []).length;
}

function stripInjected(body, slug) {
  return body
    .split('\n')
    .filter((l) => !l.includes(`/images/articles/${slug}/`))
    .join('\n');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Turn a heading into a clean SEO alt sentence: drops any "Label:" prefix
// (e.g. "Step 1:" or "Reclaim.ai:"), uses sentence case, and caps at 8 words.
// Kept only as a last-resort fallback (alt must NOT repeat the heading).
function headingAlt(text) {
  let t = String(text || '').trim();
  const c = t.indexOf(':');
  if (c !== -1) t = t.slice(c + 1);
  t = t.replace(/^step\s+\d+\s*/i, '').trim();
  let words = t.split(/\s+/).filter(Boolean);
  if (words.length > 8) words = words.slice(0, 8);
  if (words.length === 0) return '';
  const lower = words.join(' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Words we avoid using as the alt subject (they're usually verbs/stopwords
// that Pixabay returns from the query rather than the image's visual content).
const SUBJECT_STOP = new Set([
  'read', 'ask', 'pick', 'write', 'looking', 'defend', 'learn', 'focus',
  'what', 'who', 'how', 'why', 'where', 'when', 'to', 'a', 'an', 'the',
  'and', 'or', 'i', 'you', 'we', 'they', 'it', 'is', 'are', 'be', 'do', 'does',
]);

// Build a SEO alt from the image's visual subject + the article's topic/context.
// Never repeats the heading/title, never uses "Image of", no keyword lists.
function imageAlt(hit, ctx) {
  const tags = String(hit.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set();
  const ctxKey = ctx.replace(/[^a-z]/gi, '').toLowerCase();
  let subject = '';
  for (const p of tags) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (k.replace(/[^a-z]/gi, '') === ctxKey) continue; // don't repeat the context
    if (!SUBJECT_STOP.has(k)) {
      subject = p;
      break;
    }
    if (!subject) subject = p; // fallback to first if all are stopwords
  }
  if (!subject) return '';
  const phrase = `${subject} example for ${ctx}`.toLowerCase();
  const words = phrase.split(/\s+/);
  const capped = words.slice(0, 8).join(' ');
  return capitalize(capped);
}

function buildImgTag(img) {
  return (
    `<img src="${img.src}" alt="${escapeAttr(img.alt)}" ` +
    `width="${img.width}" height="${img.height}" loading="lazy" />`
  );
}

// Derive a Pixabay query from a heading: use the text after a colon when
// present (e.g. "Step 2: Choose Suppliers" -> "Choose Suppliers").
function h2Query(text) {
  const c = text.indexOf(':');
  const t = c !== -1 ? text.slice(c + 1) : text;
  return t.trim();
}

// Rank hits by how well their tags match the query tokens.
function rankHits(hits, q) {
  return hits
    .map((h) => ({ h, s: scoreHit(h, tokenize(q)) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.h);
}

function injectImages(body, imgs) {
  const lines = body.split('\n');
  const out = [];
  const placed = new Set();
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const m = imgs.find((im) => im.afterLine === i && !placed.has(im.src));
    if (m) {
      out.push('', buildImgTag(m), '');
      placed.add(m.src);
    }
  }
  // Append any images without a heading (afterLine === -1).
  for (const im of imgs) {
    if (!placed.has(im.src)) {
      out.push('', buildImgTag(im), '');
      placed.add(im.src);
    }
  }
  return out.join('\n');
}

/* ------------------------------- main ------------------------------- */

async function main() {
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

  for (const file of files) {
    const slug = file.replace(/\.(md|mdx)$/, '');
    const full = path.join(POSTS_DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const { fm, body } = parseFrontmatter(raw);

    const existing = force ? 0 : countInjected(body, slug);
    if (!force && existing === IMAGES_PER_ARTICLE) {
      console.log(`• skip ${slug} (already has ${existing} images)`);
      continue;
    }

    const title = getField(fm, 'title');
    const tags = getArrayField(fm, 'tags');
    const category = getField(fm, 'category');
    const pixCat = PIXABAY_CAT[category];

    // Fallback query for headings too generic to match anything on Pixabay.
    const articleQuery = tags.length
      ? tags.slice(0, 3).join(' ')
      : title || category || '';

    // Topic/context phrase for alt text — the article's category (never the
    // heading or title, so the alt doesn't repeat the section header).
    const altCtx = (category || tags[0] || 'article').toString().toLowerCase();

    // Work on a clean body (remove any prior injection, including duplicates).
    let workBody = existing !== IMAGES_PER_ARTICLE || force ? stripInjected(body, slug) : body;

    // Collect <h2> headings with their line index + text.
    const bodyLines = workBody.split('\n');
    const h2s = [];
    bodyLines.forEach((l, i) => {
      if (/^##\s+/.test(l)) h2s.push({ i, text: l.replace(/^##\s+/, '') });
    });

    // Choose up to IMAGES_PER_ARTICLE heading positions, evenly spaced.
    // Never target the final heading (usually "FAQ"/closing) so an image
    // doesn't land inside or after the last section.
    const count = IMAGES_PER_ARTICLE;
    const placementH2s = h2s.length > 1 ? h2s.slice(0, -1) : h2s;
    const targetIdx = [];
    if (placementH2s.length === 0) {
      // no headings: images get appended at the end
    } else if (placementH2s.length < count) {
      for (let k = 0; k < placementH2s.length; k++) targetIdx.push(placementH2s[k].i);
    } else {
      for (let k = 0; k < count; k++) {
        const pos = Math.min(
          placementH2s.length - 1,
          Math.floor(((k + 1) * placementH2s.length) / (count + 1))
        );
        targetIdx.push(placementH2s[pos].i);
      }
    }

    const imgs = [];
    const localHashes = new Set();

    // Fetch + place one image for a query, positioned after `afterLine`,
    // with `altText` used as the alt (the heading sentence for that section).
    async function placeOne(q, afterLine, altText) {
      try {
        let hits = await searchPixabay(q, pixCat);
        let ranked = rankHits(hits, q);
        // If the best match has zero tag overlap, fall back to the article topic.
        if (ranked.length && scoreHit(ranked[0], tokenize(q)) === 0 && q !== articleQuery) {
          const fbHits = await searchPixabay(articleQuery, pixCat);
          const fbRanked = rankHits(fbHits, articleQuery);
          if (fbRanked.length) {
            ranked = fbRanked;
            q = articleQuery;
          }
        }
        for (const hit of ranked) {
          if (imgs.length >= count) break;
          try {
            const buf = await fetchBuffer(hit.url);
            const h = hashBuffer(buf);
            if (localHashes.has(h) || globalHashes.has(h)) continue;
            const { outBuf, width, height } = await compressBuffer(buf);
            const idx = imgs.length + 1;
            const outDir = path.join(IMG_BASE, slug);
            fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, `img${idx}.webp`);
            fs.writeFileSync(outPath, outBuf);
            localHashes.add(h);
            globalHashes.add(h);
            const alt = imageAlt(hit, altCtx) || headingAlt(altText) || q;
            imgs.push({
              src: `/images/articles/${slug}/img${idx}.webp`,
              alt,
              width,
              height,
              afterLine,
            });
            console.log(`  ✓ ${slug}/img${idx}.webp (${width}x${height}) for "${q}"`);
            return true;
          } catch {
            // try the next candidate URL
          }
        }
      } catch (e) {
        console.warn(`  ! query "${q}" failed: ${e.message}`);
      }
      return false;
    }

    // Place an image under each chosen heading, using that heading's text
    // as both the query source and the alt sentence.
    for (const idx of targetIdx) {
      const h2text = h2s.find((h) => h.i === idx).text;
      await placeOne(h2Query(h2text), idx, h2text);
    }

    // If we still need more (e.g. article had no usable headings), append at end.
    while (imgs.length < count) {
      if (!(await placeOne(articleQuery, -1, title))) break;
    }

    if (imgs.length === 0) {
      console.warn(`✗ no images for ${slug}; skipping`);
      continue;
    }

    const newBody = injectImages(workBody, imgs);
    fs.writeFileSync(full, `---\n${fm}\n---${newBody}`);
    console.log(`✔ injected ${imgs.length} image(s) into ${slug}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
