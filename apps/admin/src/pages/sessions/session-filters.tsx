import { ALMOST_FULL_FILTER, SESSION_LIST_CONTROLS } from '@ers/shared';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Switch from '@mui/material/Switch';

import { filterText, SearchFilterForm } from '../../components/filter-form';

import type { CrudFilters } from '@refinedev/core';

const ALMOST_FULL_HELP_ID = 'almost-full-help';

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
      <FormControl>
        <FormControlLabel
          control={
            <Switch
              name={ALMOST_FULL_FILTER.field}
              color="error"
              checked={filterText(ALMOST_FULL_FILTER.field, filters) === ALMOST_FULL_FILTER.value}
              onChange={(_event, checked) => {
                onChange([
                  {
                    field: ALMOST_FULL_FILTER.field,
                    operator: 'eq',
                    value: checked ? ALMOST_FULL_FILTER.value : undefined,
                  },
                ]);
              }}
              slotProps={{ input: { 'aria-describedby': ALMOST_FULL_HELP_ID } }}
            />
          }
          label={SESSION_LIST_CONTROLS.almostFull.label}
        />
        {/* Shown, not hidden in a tooltip: it says the switch keeps the red rows. */}
        <FormHelperText id={ALMOST_FULL_HELP_ID} sx={{ mt: 0 }}>
          {SESSION_LIST_CONTROLS.almostFull.help}
        </FormHelperText>
      </FormControl>
    </SearchFilterForm>
  );
}
