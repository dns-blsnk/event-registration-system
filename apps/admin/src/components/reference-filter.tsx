import Autocomplete from '@mui/material/Autocomplete';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { useAutocomplete } from '@refinedev/mui';
import { useState } from 'react';

import { filterText, searchByQ } from './filter-form';

import type { FieldDescription } from '@ers/shared';
import type { BaseRecord, CrudFilters } from '@refinedev/core';

const NOT_FOUND_LABEL = 'Not found (clear to remove)';
const NO_OPTION_FILTERS: CrudFilters = [];

interface ReferenceFilterProps {
  /** URL filter it sets, such as `tagId`. */
  name: string;
  description: FieldDescription;
  resource: string;
  /** How an option is shown, such as a tag's name or "Olena (Organizer)". */
  labelOf: (record: ReferenceOption) => string;
  filters: CrudFilters;
  onChange: (filters: CrudFilters) => void;
  /** Fixed filters on the options themselves, such as "only possible owners". */
  optionFilters?: CrudFilters;
}

/** An option record: its id, plus whatever fields its label uses. */
export interface ReferenceOption extends BaseRecord {
  id: string;
}

/**
 * A filter that picks one record of another resource (a tag, an owner). Options are searched on
 * the server by `q`, and the picked record's id goes into the URL like any other filter.
 */
export function ReferenceFilter({
  name,
  description,
  resource,
  labelOf,
  filters,
  onChange,
  optionFilters = NO_OPTION_FILTERS,
}: ReferenceFilterProps): React.JSX.Element {
  const selectedId = filterText(name, filters);
  // Only an id that came with the URL needs loading; a picked one is already among the options.
  const [initialId] = useState(selectedId);
  const { autocompleteProps } = useAutocomplete<ReferenceOption>({
    resource,
    onSearch: searchByQ,
    filters: optionFilters,
    ...(initialId === '' ? {} : { defaultValue: initialId }),
  });
  const found = autocompleteProps.options.find((option) => option.id === selectedId);
  // A filter id that matches nothing (deleted tag, edited URL) stays visible so it can be cleared.
  const selected = selectedId === '' ? null : (found ?? { id: selectedId });
  return (
    <Autocomplete
      {...autocompleteProps}
      value={selected}
      onChange={(_event, option) => {
        onChange([{ field: name, operator: 'eq', value: option === null ? undefined : option.id }]);
      }}
      getOptionLabel={(option) => {
        const label = labelOf(option);
        return label === '' ? NOT_FOUND_LABEL : label;
      }}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      sx={{ minWidth: 220 }}
      size="small"
      renderInput={(params) => (
        <TextField
          {...(params as TextFieldProps)}
          label={description.label}
          helperText={description.help}
        />
      )}
    />
  );
}
