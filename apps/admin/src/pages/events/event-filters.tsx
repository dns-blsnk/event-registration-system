import {
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  EVENT_STATUS_LABELS,
  EVENT_STATUSES,
} from '@ers/shared';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import {
  ApplySearchButton,
  filterText,
  submitTextFilters,
  TextFilterField,
} from '../../components/filter-form';

import type { CrudFilters } from '@refinedev/core';

interface EventFiltersProps {
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

/** Search, status and city filters; every change goes to the server, which does the filtering. */
export function EventFilters({ filters, onChange }: EventFiltersProps): React.JSX.Element {
  return (
    <Stack
      component="form"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 2 }}
      alignItems={{ sm: 'flex-start' }}
      onSubmit={submitTextFilters(['q', 'city'], onChange)}
    >
      <TextFilterField name="q" description={EVENT_LIST_CONTROLS.search} filters={filters} />
      <TextFilterField name="city" description={EVENT_FIELDS.city} filters={filters} />
      <ApplySearchButton />
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
