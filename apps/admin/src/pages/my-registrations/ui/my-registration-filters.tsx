import {
  MY_REGISTRATION_LIST_CONTROLS,
  REGISTRATION_FIELDS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
} from '@ers/shared';

import { DateFilter } from '@/shared/ui/date-filter';
import { filterText, SearchFilterForm, SelectFilterField } from '@/shared/ui/filter-form';

import type { CrudFilters } from '@refinedev/core';

interface MyRegistrationFiltersProps {
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

/** Title search, status and the days the session starts; the server filters the customer's own. */
export function MyRegistrationFilters({
  filters,
  onChange,
}: MyRegistrationFiltersProps): React.JSX.Element {
  return (
    <SearchFilterForm
      otherFields={['status', 'startsFrom', 'startsTo']}
      textFilters={[{ name: 'q', description: MY_REGISTRATION_LIST_CONTROLS.search }]}
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
      <DateFilter
        name="startsFrom"
        description={MY_REGISTRATION_LIST_CONTROLS.startsFrom}
        bound="start"
        limit={filterText('startsTo', filters)}
        filters={filters}
        onChange={onChange}
      />
      <DateFilter
        name="startsTo"
        description={MY_REGISTRATION_LIST_CONTROLS.startsTo}
        bound="end"
        limit={filterText('startsFrom', filters)}
        filters={filters}
        onChange={onChange}
      />
    </SearchFilterForm>
  );
}
