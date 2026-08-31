/**
 * Global site configuration used across SEO, layouts and JSON-LD.
 */
export const SITE = {
  name: 'UpNorthHub',
  shortName: 'UNH',
  description:
    'UpNorthHub is a high-signal digital magazine covering content creation, e-commerce, tooling and gig work for builders living and working up north — and everywhere else.',
  url: 'https://upnorthhub.com',
  lang: 'en',
  locale: 'en_US',
  author: 'UpNorthHub Editorial',
  twitter: '@upnorthhub',
  email: 'wm@upnorthhub.com',
  logo: '/logo.svg',
  ogImage: '/og-default.svg',
  nav: [
    { label: 'Content Creation', href: '/category/content-creation' },
    { label: 'E-Commerce', href: '/category/e-commerce' },
    { label: 'Tools', href: '/category/tools' },
    { label: 'Gig Work', href: '/category/gig-work' },
    { label: 'Tags', href: '/tags' },
  ],
} as const;
