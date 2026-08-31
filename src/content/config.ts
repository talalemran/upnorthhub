import { defineCollection, z } from 'astro:content';

/**
 * Posts collection — the core editorial content of UpNorthHub.
 * Supports both .md and .mdx entries.
 */
const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.object({
      name: z.string(),
      avatar: z.string(),
      role: z.string(),
    }),
    category: z.enum(['content-creation', 'e-commerce', 'tools', 'gig-work']),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
    coverImage: z.string().optional(),
    coverImageAlt: z.string().optional(),
  }),
});

export const collections = { posts };
