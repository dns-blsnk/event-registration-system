import {
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  EVENT_STATUS_LABELS,
  EVENT_STATUSES,
} from '@ers/shared';
import Stack from '@mui/material/Stack';

import {
  ApplySearchButton,
  SelectFilterField,
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
      <SelectFilterField
        name="status"
        description={EVENT_FIELDS.status}
        values={EVENT_STATUSES}
        labels={EVENT_STATUS_LABELS}
        filters={filters}
        onChange={onChange}
      />
    </Stack>
  );
}
