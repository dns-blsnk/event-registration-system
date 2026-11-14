import {
  REGISTRATION_FIELDS,
  REGISTRATION_LIST_CONTROLS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
} from '@ers/shared';
import Stack from '@mui/material/Stack';

import {
  ApplySearchButton,
  SelectFilterField,
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
      <SelectFilterField
        name="status"
        description={REGISTRATION_FIELDS.status}
        values={REGISTRATION_STATUSES}
        labels={REGISTRATION_STATUS_LABELS}
        filters={filters}
        onChange={onChange}
      />
    </Stack>
  );
}
