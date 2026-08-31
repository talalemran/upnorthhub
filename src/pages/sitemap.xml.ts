import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../lib/site';
import { CATEGORY_ORDER, getUniqueAuthors, authorSlug } from '../lib/posts';

/**
 * Self-contained sitemap.xml endpoint.
 * Unlike @astrojs/sitemap (build-only, split into sitemap-index.xml), this
 * produces a single /sitemap.xml that is available in BOTH `astro dev` and
 * `astro build`, so the file always exists.
 */
export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');
  const authors = getUniqueAuthors(posts);

  const tags = new Set<string>();
  for (const post of posts) for (const t of post.data.tags) tags.add(t.toLowerCase());

  const urls: { loc: string; lastmod?: string }[] = [];

  const add = (path: string, lastmod?: Date) =>
    urls.push({ loc: new URL(path, SITE.url).toString(), lastmod: lastmod?.toISOString() });

  // Static pages
  for (const p of ['/', '/about', '/contact', '/search', '/tags', '/sitemap']) add(p);

  // Categories
  for (const c of CATEGORY_ORDER) add(`/category/${c}`);

  // Tags
  for (const t of tags) add(`/tags/${t}`);

  // Authors
  for (const a of authors) add(`/author/${authorSlug(a.name)}`);

  // Posts
  for (const post of posts) add(`/posts/${post.slug}/`, post.data.updatedDate ?? post.data.pubDate);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${
        u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''
      }</url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
