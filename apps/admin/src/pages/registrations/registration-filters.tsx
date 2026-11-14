import {
  REGISTRATION_FIELDS,
  REGISTRATION_LIST_CONTROLS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
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

interface RegistrationFiltersProps {
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

/** Customer search and status; the server does the filtering. */
export function RegistrationFilters({
  filters,
  onChange,
}: RegistrationFiltersProps): React.JSX.Element {
  return (
    <Stack
      component="form"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 2 }}
      alignItems={{ sm: 'flex-start' }}
      onSubmit={submitTextFilters(['q'], onChange)}
    >
      <TextFilterField name="q" description={REGISTRATION_LIST_CONTROLS.search} filters={filters} />
      <ApplySearchButton />
      <TextField
        select
        label={REGISTRATION_FIELDS.status.label}
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
        {REGISTRATION_STATUSES.map((status) => (
          <MenuItem key={status} value={status}>
            {REGISTRATION_STATUS_LABELS[status]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
