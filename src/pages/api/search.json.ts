import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CATEGORY_LABELS } from '../../lib/posts';
import type { SearchDoc } from '../../lib/search';

/**
 * Static search index served as /api/search.json.
 * Consumed lazily by the client-side SearchModal (Fuse.js) and the /search page.
 * Only lightweight metadata is exposed — never the full body.
 */
export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');

  const docs: SearchDoc[] = posts
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((post) => ({
      title: post.data.title,
      description: post.data.description,
      category: post.data.category,
      categoryLabel: CATEGORY_LABELS[post.data.category],
      tags: post.data.tags,
      author: post.data.author.name,
      pubDate: post.data.pubDate.toISOString(),
      url: `/posts/${post.slug}/`,
    }));

  return new Response(JSON.stringify(docs), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
