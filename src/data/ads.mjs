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
export const fallbackAd = {
  image: '/images/hostpapa.webp',
  link: 'https://www.hostpapa.com/?a_aid=10626',
  alt: 'HostPapa web hosting',
  width: 1104,
  height: 736,
};

export const ads = [fallbackAd];

// Pick a random ad from the list (deterministic per render call).
export function pickAd() {
  const validAds = Array.isArray(ads) && ads.length > 0 ? ads : [fallbackAd];
  return validAds[Math.floor(Math.random() * validAds.length)] ?? fallbackAd;
}
