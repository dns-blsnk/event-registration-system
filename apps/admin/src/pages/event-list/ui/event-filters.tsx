import {
  Action,
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  EVENT_OWNERS_FILTER,
  EVENT_STATUS_LABELS,
  EVENT_STATUSES,
  isRole,
  Resource,
  ROLE_LABELS,
} from '@ers/shared';
import { useCan } from '@refinedev/core';

import { DateFilter } from '@/shared/ui/date-filter';
import { filterText, SearchFilterForm, SelectFilterField } from '@/shared/ui/filter-form';
import { ReferenceFilter, type ReferenceOption } from '@/shared/ui/reference-filter';

import type { CrudFilters } from '@refinedev/core';

interface EventFiltersProps {
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

function tagLabel(tag: ReferenceOption): string {
  return typeof tag.name === 'string' ? tag.name : '';
}

/** Only people who can own an event (organizers and admins), never customers. */
const OWNER_OPTIONS: CrudFilters = [
  { field: EVENT_OWNERS_FILTER.field, operator: 'eq', value: EVENT_OWNERS_FILTER.value },
];

/** Admins can own events too, so the role is shown next to the name. */
function ownerLabel(user: ReferenceOption): string {
  const name = typeof user.name === 'string' ? user.name : '';
  return isRole(user.role) ? `${name} (${ROLE_LABELS[user.role]})` : name;
}

/**
 * Search, city, status, tag, start days and (for admins) the owner. Every change goes to the
 * server, which does the filtering; organizers only ever get their own events anyway.
 */
export function EventFilters({ filters, onChange }: EventFiltersProps): React.JSX.Element {
  // Only admins see other owners' events, and listing users to pick from is theirs alone too.
  const { data: usersAccess } = useCan({ resource: Resource.USERS, action: Action.LIST });
  const canPickOwner = usersAccess?.can === true;
  return (
    <SearchFilterForm
      // Only filters with a control on screen; "Clear filters" never resets one the viewer cannot see.
      otherFields={[
        'status',
        'tagId',
        'startsFrom',
        'startsTo',
        ...(canPickOwner ? ['organizerId'] : []),
      ]}
      textFilters={[
        { name: 'q', description: EVENT_LIST_CONTROLS.search },
        { name: 'city', description: EVENT_LIST_CONTROLS.city },
      ]}
      filters={filters}
      onChange={onChange}
    >
      <SelectFilterField
        name="status"
        description={EVENT_FIELDS.status}
        values={EVENT_STATUSES}
        labels={EVENT_STATUS_LABELS}
        filters={filters}
        onChange={onChange}
      />
      <ReferenceFilter
        name="tagId"
        description={EVENT_LIST_CONTROLS.tag}
        resource={Resource.TAGS}
        labelOf={tagLabel}
        filters={filters}
        onChange={onChange}
      />
      <DateFilter
        name="startsFrom"
        description={EVENT_LIST_CONTROLS.startsFrom}
        bound="start"
        limit={filterText('startsTo', filters)}
        filters={filters}
        onChange={onChange}
      />
      <DateFilter
        name="startsTo"
        description={EVENT_LIST_CONTROLS.startsTo}
        bound="end"
        limit={filterText('startsFrom', filters)}
        filters={filters}
        onChange={onChange}
      />
      {canPickOwner && (
        <ReferenceFilter
          name="organizerId"
          description={EVENT_LIST_CONTROLS.organizer}
          resource={Resource.USERS}
          labelOf={ownerLabel}
          optionFilters={OWNER_OPTIONS}
          filters={filters}
          onChange={onChange}
        />
      )}
    </SearchFilterForm>
  );
}
