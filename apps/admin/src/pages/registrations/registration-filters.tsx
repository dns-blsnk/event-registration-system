import {
  REGISTRATION_FIELDS,
  REGISTRATION_LIST_CONTROLS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
} from '@ers/shared';

import { SearchFilterForm, SelectFilterField } from '../../components/filter-form';

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
    <SearchFilterForm
      textFilters={[{ name: 'q', description: REGISTRATION_LIST_CONTROLS.search }]}
      filters={filters}
      onChange={onChange}
    >
      <SelectFilterField
        name="status"
        description={REGISTRATION_FIELDS.status}
        values={REGISTRATION_STATUSES}
        labels={REGISTRATION_STATUS_LABELS}
        filters={filters}
        onChange={onChange}
      />
    </SearchFilterForm>
  );
}
