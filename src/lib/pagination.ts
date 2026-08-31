/**
 * pagination.ts — Manual pagination helper for Astro v4.
 */
interface PaginatedPage<T> {
  data: T[];
  current: number;
  total: number;
  totalItems: number;
  size: number;
}

export function paginate<T>(
  items: T[],
  { page, size }: { page: number; size: number }
): PaginatedPage<T> {
  const total = Math.ceil(items.length / size);
  const current = Math.max(1, Math.min(page, total));
  const start = (current - 1) * size;
  const data = items.slice(start, start + size);

  return {
    data,
    current,
    total,
    totalItems: items.length,
    size,
  };
}
