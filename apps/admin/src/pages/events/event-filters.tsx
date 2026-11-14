import {
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  EVENT_STATUS_LABELS,
  EVENT_STATUSES,
} from '@ers/shared';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { getDefaultFilter, type CrudFilters } from '@refinedev/core';

import type { SyntheticEvent } from 'react';

interface EventFiltersProps {
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

/** The current text value of a server filter, or '' when it is not set. */
function filterText(field: string, filters: CrudFilters): string {
  const value: unknown = getDefaultFilter(field, filters);
  return typeof value === 'string' ? value : '';
}

/** A trimmed form value; empty means "remove this filter". */
function formText(form: FormData, field: string): string | undefined {
  const value = form.get(field);
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? undefined : text;
}

/** Search, status and city filters; every change goes to the server, which does the filtering. */
export function EventFilters({ filters, onChange }: EventFiltersProps): React.JSX.Element {
  const search = filterText('q', filters);
  const city = filterText('city', filters);
  const submitText = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onChange([
      { field: 'q', operator: 'eq', value: formText(form, 'q') },
      { field: 'city', operator: 'eq', value: formText(form, 'city') },
    ]);
  };
  return (
    <Stack
      component="form"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 2 }}
      alignItems={{ sm: 'flex-start' }}
      onSubmit={submitText}
    >
      {/* Keyed by the active value, so the box follows filters changed by the menu or Back. */}
      <TextField
        key={`q:${search}`}
        name="q"
        label={EVENT_LIST_CONTROLS.search.label}
        helperText={EVENT_LIST_CONTROLS.search.help}
        defaultValue={search}
        size="small"
      />
      <TextField
        key={`city:${city}`}
        name="city"
        label={EVENT_FIELDS.city.label}
        helperText={EVENT_FIELDS.city.help}
        defaultValue={city}
        size="small"
      />
      <IconButton type="submit" aria-label="Apply search">
        <SearchIcon />
      </IconButton>
      <TextField
        select
        label={EVENT_FIELDS.status.label}
        value={filterText('status', filters)}
        onChange={(event) => {
          onChange([
            {
              field: 'status',
              operator: 'eq',
              value: event.target.value === '' ? undefined : event.target.value,
            },
          ]);
        }}
        size="small"
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">All</MenuItem>
        {EVENT_STATUSES.map((status) => (
          <MenuItem key={status} value={status}>
            {EVENT_STATUS_LABELS[status]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
