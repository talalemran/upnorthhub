import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;
export type PostCategory = Post['data']['category'];

export const CATEGORY_LABELS: Record<PostCategory, string> = {
  'content-creation': 'Content Creation',
  'e-commerce': 'E-Commerce',
  tools: 'Tools',
  'gig-work': 'Gig Work',
};

export const CATEGORY_DESCRIPTIONS: Record<PostCategory, string> = {
  'content-creation':
    'Strategies, workflows and tools for creators shipping high-quality digital content.',
  'e-commerce':
    'Storefronts, conversions and the operational playbooks behind modern online retail.',
  tools: 'Battle-tested software, automation and hardware for independent operators.',
  'gig-work':
    'The freelance and on-demand economy — how to earn, scale and stay sane.',
};

export const CATEGORY_ORDER: PostCategory[] = [
  'content-creation',
  'e-commerce',
  'tools',
  'gig-work',
];

export const CATEGORY_SLUGS = CATEGORY_ORDER;

/**
 * Returns the human readable label for a category slug, falling back to the
 * slug itself (title-cased) when unknown.
 */
export function categoryLabel(slug: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[slug] ?? titleCase(slug);
}

export function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface AuthorInfo {
  name: string;
  avatar: string;
  role: string;
}

/** URL-safe slug for an author, derived from their name. */
export function authorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Deduplicated list of authors found across the given posts. */
export function getUniqueAuthors(posts: Post[]): AuthorInfo[] {
  const map = new Map<string, AuthorInfo>();
  for (const post of posts) {
    const a = post.data.author;
    if (!map.has(a.name)) {
      map.set(a.name, { name: a.name, avatar: a.avatar, role: a.role });
    }
  }
  return Array.from(map.values());
}

/**
 * Estimate reading time in minutes from raw markdown / mdx body text.
 * Assumes an average adult reading speed of ~200 words per minute.
 */
export function getReadingTime(body: string): number {
  const clean = body
    .replace(/```[\s\S]*?```/g, ' ') // strip code blocks
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ') // strip images
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1') // keep link text
    .replace(/[#>*_`~-]/g, ' ') // strip md punctuation
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.length ? clean.split(' ').length : 0;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Format a date as an absolute, human readable UTC-safe string.
 */
export function formatDate(date: Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...opts,
  }).format(date);
}

export function formatISO(date: Date): string {
  return date.toISOString();
}
