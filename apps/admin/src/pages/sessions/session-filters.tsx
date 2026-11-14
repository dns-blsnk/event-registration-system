import { SESSION_LIST_CONTROLS } from '@ers/shared';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';

import {
  ApplySearchButton,
  filterText,
  submitTextFilters,
  TextFilterField,
} from '../../components/filter-form';

import type { CrudFilters } from '@refinedev/core';

const ALMOST_FULL = 'true';

interface SessionFiltersProps {
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
}

/** Search and the "almost full" switch; the server does the filtering. */
export function SessionFilters({ filters, onChange }: SessionFiltersProps): React.JSX.Element {
  return (
    <Stack
      component="form"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 2 }}
      alignItems={{ sm: 'flex-start' }}
      onSubmit={submitTextFilters(['q'], onChange)}
    >
      <TextFilterField name="q" description={SESSION_LIST_CONTROLS.search} filters={filters} />
      <ApplySearchButton />
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
    </Stack>
  );
}
