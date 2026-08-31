/**
 * External ads configuration.
 *
 * Add more entries here to rotate ads. The ad unit (Ad.astro and the
 * rehype-insert-ad plugin) picks one at random per page from this list.
 *
 * Each entry:
 *  - image:  path under /public (e.g. /images/hostpapa.webp)
 *  - link:   destination URL (opened in a new tab)
 *  - alt:    accessible alt text for the banner
 *  - width / height: intrinsic image dimensions
 */
export const ads = [
  {
    image: '/images/hostpapa.webp',
    link: 'https://www.hostpapa.com/?a_aid=10626',
    alt: 'HostPapa web hosting',
    width: 1104,
    height: 736,
  },
];

// Pick a random ad from the list (deterministic per render call).
export function pickAd() {
  return ads[Math.floor(Math.random() * ads.length)];
}
