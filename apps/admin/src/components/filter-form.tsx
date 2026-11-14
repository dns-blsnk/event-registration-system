import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import { getDefaultFilter, type CrudFilters } from '@refinedev/core';

/** The current text value of a server filter, or '' when it is not set. */
export function filterText(field: string, filters: CrudFilters): string {
  const value: unknown = getDefaultFilter(field, filters);
  return typeof value === 'string' ? value : '';
}

/** A trimmed form value; empty means "remove this filter". */
export function formText(form: FormData, field: string): string | undefined {
  const value = form.get(field);
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? undefined : text;
}

/** Submits a filter form's text boxes; text filters apply on submit, not on every key. */
export function ApplySearchButton(): React.JSX.Element {
  return (
    <IconButton type="submit" aria-label="Apply search">
      <SearchIcon />
    </IconButton>
  );
}
