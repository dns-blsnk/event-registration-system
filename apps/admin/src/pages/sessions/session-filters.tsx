import { SESSION_LIST_CONTROLS } from '@ers/shared';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';

import { filterText, SearchFilterForm } from '../../components/filter-form';

import type { CrudFilters } from '@refinedev/core';

const ALMOST_FULL = 'true';

interface SessionFiltersProps {
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

/** Search and the "almost full" switch; the server does the filtering. */
export function SessionFilters({ filters, onChange }: SessionFiltersProps): React.JSX.Element {
  return (
    <SearchFilterForm
      textFilters={[{ name: 'q', description: SESSION_LIST_CONTROLS.search }]}
      filters={filters}
      onChange={onChange}
    >
      {/* describeChild keeps "Almost full" as the switch's name and the help as its description. */}
      <Tooltip title={SESSION_LIST_CONTROLS.almostFull.help} describeChild>
        <FormControlLabel
          control={
            <Switch
              checked={filterText('almostFull', filters) === ALMOST_FULL}
              onChange={(_event, checked) => {
                onChange([
                  { field: 'almostFull', operator: 'eq', value: checked ? ALMOST_FULL : undefined },
                ]);
              }}
            />
          }
          label={SESSION_LIST_CONTROLS.almostFull.label}
        />
      </Tooltip>
    </SearchFilterForm>
  );
}
