/**
 * rehype-insert-ad.mjs
 * --------------------------------------------------------------
 * Rehype plugin that injects a sponsored ad into the middle of an
 * article's rendered markdown. The ad is read from the external
 * `src/data/ads.mjs` file and chosen at random.
 *
 * It inserts the ad after the middle top-level <p> (only when the
 * article has at least 4 paragraphs), so it lands roughly in the
 * middle of the body without touching headings or the TOC.
 */
import { pickAd, fallbackAd } from '../data/ads.mjs';

function buildAdHast(ad) {
  const safeAd = ad ?? fallbackAd;

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['article-ad', 'my-10', 'text-center', 'not-prose'] },
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: {
          className: [
            'block',
            'mb-2',
            'text-[11px]',
            'uppercase',
            'tracking-widest',
            'text-zinc-400',
            'dark:text-zinc-300',
          ],
        },
        children: [{ type: 'text', value: 'Advertisement' }],
      },
      {
        type: 'element',
        tagName: 'a',
        properties: {
          href: safeAd.link,
          target: '_blank',
          rel: 'noopener sponsored nofollow',
          className: [
            'inline-block',
            'rounded-xl',
            'overflow-hidden',
            'transition',
            'hover:opacity-90',
          ],
        },
        children: [
          {
            type: 'element',
            tagName: 'img',
            properties: {
              src: safeAd.image,
              alt: safeAd.alt,
              width: safeAd.width,
              height: safeAd.height,
              loading: 'lazy',
              className: ['mx-auto', 'block', 'w-full', 'max-w-2xl', 'h-auto'],
            },
            children: [],
          },
        ],
      },
    ],
  };
}

export default function rehypeInsertAd() {
  return (tree) => {
    const ad = pickAd();
    const adNode = buildAdHast(ad);
    const children = Array.isArray(tree.children) ? tree.children : [];

    if (children.length === 0) {
      return;
    }

    const pIndices = [];
    children.forEach((node, i) => {
      if (node?.type === 'element' && node.tagName === 'p') pIndices.push(i);
    });

    if (pIndices.length === 0) {
      children.push(adNode);
      return;
    }

    const mid = pIndices[Math.min(Math.floor(pIndices.length / 2), pIndices.length - 1)];
    children.splice(mid + 1, 0, adNode);
  };
}
