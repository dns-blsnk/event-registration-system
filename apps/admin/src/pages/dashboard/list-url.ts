/** A list page opened with filters, in the URL shape Refine's syncWithLocation reads. */
export function listUrl(path: string, filters: Readonly<Record<string, string>>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([field, value], index) => {
    params.set(`filters[${String(index)}][field]`, field);
    params.set(`filters[${String(index)}][operator]`, 'eq');
    params.set(`filters[${String(index)}][value]`, value);
  });
  return `${path}?${params.toString()}`;
}
