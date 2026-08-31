/**
 * Shared search contract used by:
 *  - the static index endpoint (/api/search.json)
 *  - the SearchModal client component
 *  - the /search fallback page
 */
export interface SearchDoc {
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  tags: string[];
  author: string;
  pubDate: string;
  url: string;
}
