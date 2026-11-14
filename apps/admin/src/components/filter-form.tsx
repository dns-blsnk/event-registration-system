import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { getDefaultFilter, type CrudFilters } from '@refinedev/core';

import type { FieldDescription } from '@ers/shared';
import type { SyntheticEvent } from 'react';

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

/**
 * A free-text filter box. Uncontrolled, so typing does not refetch; keyed by the active value, so
 * the box still follows filters changed elsewhere (another control, Back).
 */
export function TextFilterField({
  name,
  description,
  filters,
}: {
  name: string;
  description: FieldDescription;
  filters: CrudFilters;
}): React.JSX.Element {
  const value = filterText(name, filters);
  return (
    <TextField
      key={`${name}:${value}`}
      name={name}
      label={description.label}
      helperText={description.help}
      defaultValue={value}
      size="small"
    />
  );
}

/** Submit handler of a filter form: applies the named text boxes, an emptied box removes its filter. */
export function submitTextFilters(
  names: readonly string[],
  onChange: (filters: CrudFilters) => void,
): (event: SyntheticEvent<HTMLFormElement>) => void {
  return (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onChange(names.map((name) => ({ field: name, operator: 'eq', value: formText(form, name) })));
  };
}

/** The active value if it is one of the choices; a stale or hand-edited URL value shows as "All". */
function selectedValue(name: string, filters: CrudFilters, values: readonly string[]): string {
  const value = filterText(name, filters);
  return values.includes(value) ? value : '';
}

interface SelectFilterFieldProps<TValue extends string> {
  name: string;
  description: FieldDescription;
  values: readonly TValue[];
  labels: Readonly<Record<TValue, string>>;
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

/** A pick-one filter with an "All" choice that removes it; applies as soon as a value is picked. */
export function SelectFilterField<TValue extends string>({
  name,
  description,
  values,
  labels,
  filters,
  onChange,
}: SelectFilterFieldProps<TValue>): React.JSX.Element {
  return (
    <TextField
      select
      label={description.label}
      value={selectedValue(name, filters, values)}
      onChange={(event) => {
        const value = event.target.value;
        onChange([{ field: name, operator: 'eq', value: value === '' ? undefined : value }]);
      }}
      size="small"
      sx={{ minWidth: 160 }}
    >
      <MenuItem value="">All</MenuItem>
      {values.map((value) => (
        <MenuItem key={value} value={value}>
          {labels[value]}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * The change handler every list gives its filters: a new filter starts from the first page, since
 * staying on page 3 of the old result could show nothing.
 */
export function applyFiltersFromFirstPage({
  setCurrentPage,
  setFilters,
}: {
  setCurrentPage: (page: number) => void;
  setFilters: (filters: CrudFilters, behavior: 'merge') => void;
}): (filters: CrudFilters) => void {
  return (changed) => {
    setCurrentPage(1);
    setFilters(changed, 'merge');
  };
}

/** A free-text filter of a search form: the URL field it sets and its shared label and help. */
export interface TextFilter {
  name: string;
  description: FieldDescription;
}

interface SearchFilterFormProps {
  textFilters: readonly TextFilter[];
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
  /** Controls after the search button that apply at once, such as pick-one filters. */
  children?: React.ReactNode;
}

/**
 * The filter row every list shares: text boxes applied together on submit, the search button, then
 * instant controls. Stacks into a column on narrow screens.
 */
export function SearchFilterForm({
  textFilters,
  filters,
  onChange,
  children,
}: SearchFilterFormProps): React.JSX.Element {
  return (
    <Stack
      component="form"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 2 }}
      alignItems={{ sm: 'flex-start' }}
      useFlexGap
      flexWrap="wrap"
      onSubmit={submitTextFilters(
        textFilters.map((filter) => filter.name),
        onChange,
      )}
    >
      {textFilters.map((filter) => (
        <TextFilterField
          key={filter.name}
          name={filter.name}
          description={filter.description}
          filters={filters}
        />
      ))}
      <ApplySearchButton />
      {children}
    </Stack>
  );
}

/** List APIs search by `q`; Refine's default would filter a field such as "title" they do not have. */
export function searchByQ(value: string): CrudFilters {
  return [{ field: 'q', operator: 'eq', value }];
}
