/** The operator of a filter set from a link: lists match each value as it is. */
const LINK_FILTER_OPERATOR = 'eq';

/**
 * A list page opened with filters, in the URL shape Refine's syncWithLocation reads. Values are
 * encoded, so a filter value can never add parameters of its own.
 */
export function listUrl(path: string, filters: Readonly<Record<string, string>>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([field, value], index) => {
    params.set(`filters[${String(index)}][field]`, field);
    params.set(`filters[${String(index)}][operator]`, LINK_FILTER_OPERATOR);
    params.set(`filters[${String(index)}][value]`, value);
  });
  const query = params.toString();
  return query === '' ? path : `${path}?${query}`;
}
