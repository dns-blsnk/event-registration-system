import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { getDefaultFilter, type CrudFilters } from '@refinedev/core';
import { useState } from 'react';

import { SELECT_LABEL_PROPS } from './forms';
import { SearchField } from './search-field';

import type { FieldDescription } from '@ers/shared';

/** The current text value of a server filter, or '' when it is not set. */
export function filterText(field: string, filters: CrudFilters): string {
  const value: unknown = getDefaultFilter(field, filters);
  return typeof value === 'string' ? value : '';
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
      name={name}
      label={description.label}
      slotProps={{ inputLabel: SELECT_LABEL_PROPS }}
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
  /**
   * The URL fields of the controls passed as children, so "Clear filters" resets them too. Filters
   * the page fixes itself (a session's own registrations) are not listed and never cleared.
   */
  otherFields?: readonly string[];
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
  /** Controls after the search boxes, such as pick-one filters. */
  children?: React.ReactNode;
}

/**
 * The filter row every list shares: search boxes that apply as you type, then instant controls.
 * Stacks into a column on narrow screens.
 */
export function SearchFilterForm({
  textFilters,
  otherFields = [],
  filters,
  onChange,
  children,
}: SearchFilterFormProps): React.JSX.Element {
  // Bumped by "Clear filters": the search boxes start over, dropping a search still waiting to apply.
  const [resetCount, setResetCount] = useState(0);
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 2 }}
      alignItems={{ sm: 'flex-start' }}
      useFlexGap
      flexWrap="wrap"
    >
      {textFilters.map((filter) => (
        <SearchField
          key={`${filter.name}:${String(resetCount)}`}
          name={filter.name}
          description={filter.description}
          value={filterText(filter.name, filters)}
          onApply={(value) => {
            onChange([{ field: filter.name, operator: 'eq', value }]);
          }}
        />
      ))}
      {children}
      <ClearFiltersButton
        fields={[...textFilters.map((filter) => filter.name), ...otherFields]}
        filters={filters}
        onChange={(cleared) => {
          setResetCount((count) => count + 1);
          onChange(cleared);
        }}
      />
    </Stack>
  );
}

/** Resets every filter of the form at once; shown only while at least one is set. */
function ClearFiltersButton({
  fields,
  filters,
  onChange,
}: {
  fields: readonly string[];
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}): React.JSX.Element | null {
  if (fields.every((field) => filterText(field, filters) === '')) return null;
  return (
    <Button
      onClick={() => {
        onChange(fields.map((field) => ({ field, operator: 'eq', value: undefined })));
      }}
      // Level with the fields, not with their helper texts.
      sx={{ alignSelf: { sm: 'flex-start' }, mt: { sm: 0.5 } }}
    >
      Clear filters
    </Button>
  );
}

/** List APIs search by `q`; Refine's default would filter a field such as "title" they do not have. */
export function searchByQ(value: string): CrudFilters {
  return [{ field: 'q', operator: 'eq', value }];
}
