import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import rehypeInsertAd from './src/lib/rehype-insert-ad.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://upnorthhub.com',
  devToolbar: { enabled: false },
  // Image optimization settings for better LCP
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  // Improve performance with output compression
  vite: {
    ssr: {
      external: ['fuse.js'],
    },
  },
  integrations: [
    mdx(),
    sitemap(),
    tailwind({
      // We manage Tailwind base via src/styles/global.css for full control.
      applyBaseStyles: false,
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
    // Inject a sponsored ad into the middle of each article body.
    rehypePlugins: [rehypeInsertAd],
  },
});
