/**
 * GitHub-style pagination middleware.
 *
 * Reads `page` and `per_page` query params, slices the result array,
 * and sets the `Link` header with rel=first, prev, next, last.
 *
 * Usage in route handlers:
 *   const { items, linkHeader } = paginate(req, allItems);
 *   if (linkHeader) res.set('Link', linkHeader);
 *   res.json(items);
 */

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

export function paginate(req, items) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(req.query.per_page, 10) || DEFAULT_PER_PAGE));

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const sliced = items.slice(start, end);

  // Build Link header
  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  const queryWithout = { ...req.query };
  delete queryWithout.page;
  delete queryWithout.per_page;
  const qs = Object.entries(queryWithout)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const qsPrefix = qs ? `${qs}&` : '';

  const links = [];

  if (page > 1) {
    links.push(`<${baseUrl}?${qsPrefix}page=1&per_page=${perPage}>; rel="first"`);
    links.push(`<${baseUrl}?${qsPrefix}page=${page - 1}&per_page=${perPage}>; rel="prev"`);
  }
  if (page < totalPages) {
    links.push(`<${baseUrl}?${qsPrefix}page=${page + 1}&per_page=${perPage}>; rel="next"`);
    links.push(`<${baseUrl}?${qsPrefix}page=${totalPages}&per_page=${perPage}>; rel="last"`);
  }

  const linkHeader = links.length > 0 ? links.join(', ') : null;

  return { items: sliced, linkHeader, page, perPage, totalItems, totalPages };
}
