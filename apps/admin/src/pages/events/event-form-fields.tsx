import {
  EVENT_CITY_MAX_LENGTH,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_FIELDS,
  EVENT_MAX_TAGS,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_VENUE_MAX_LENGTH,
  Resource,
  type TagRef,
} from '@ers/shared';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { useAutocomplete } from '@refinedev/mui';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';

import { fieldHelp, REQUIRED } from '../../components/forms';

import type { EventFormValues } from './event-form-values';

interface EventFormFieldsProps {
  register: UseFormRegister<EventFormValues>;
  control: Control<EventFormValues>;
  errors: FieldErrors<EventFormValues>;
}

/** The fields of the event form, shared by create and edit; limits and texts come from packages/shared. */
export function EventFormFields({
  register,
  control,
  errors,
}: EventFormFieldsProps): React.JSX.Element {
  const { autocompleteProps } = useAutocomplete<TagRef>({
    resource: Resource.TAGS,
    // The tags API searches by `q`; the default would filter a "title" field it does not have.
    onSearch: (value) => [{ field: 'q', operator: 'eq', value }],
  });
  return (
    <Stack spacing={2}>
      <TextField
        {...register('title', { required: REQUIRED })}
        label={EVENT_FIELDS.title.label}
        helperText={fieldHelp(errors.title, EVENT_FIELDS.title.help)}
        error={errors.title !== undefined}
        slotProps={{ htmlInput: { maxLength: EVENT_TITLE_MAX_LENGTH } }}
        required
      />
      <TextField
        {...register('description', { required: REQUIRED })}
        label={EVENT_FIELDS.description.label}
        helperText={fieldHelp(errors.description, EVENT_FIELDS.description.help)}
        error={errors.description !== undefined}
        slotProps={{ htmlInput: { maxLength: EVENT_DESCRIPTION_MAX_LENGTH } }}
        multiline
        minRows={3}
        required
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('city', { required: REQUIRED })}
          label={EVENT_FIELDS.city.label}
          helperText={fieldHelp(errors.city, EVENT_FIELDS.city.help)}
          error={errors.city !== undefined}
          slotProps={{ htmlInput: { maxLength: EVENT_CITY_MAX_LENGTH } }}
          required
          fullWidth
        />
        <TextField
          {...register('venue', { required: REQUIRED })}
          label={EVENT_FIELDS.venue.label}
          helperText={fieldHelp(errors.venue, EVENT_FIELDS.venue.help)}
          error={errors.venue !== undefined}
          slotProps={{ htmlInput: { maxLength: EVENT_VENUE_MAX_LENGTH } }}
          required
          fullWidth
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('startsAt', { required: REQUIRED })}
          type="datetime-local"
          label={EVENT_FIELDS.startsAt.label}
          helperText={fieldHelp(errors.startsAt, EVENT_FIELDS.startsAt.help)}
          error={errors.startsAt !== undefined}
          slotProps={{ inputLabel: { shrink: true } }}
          required
          fullWidth
        />
        <TextField
          {...register('endsAt', { required: REQUIRED })}
          type="datetime-local"
          label={EVENT_FIELDS.endsAt.label}
          helperText={fieldHelp(errors.endsAt, EVENT_FIELDS.endsAt.help)}
          error={errors.endsAt !== undefined}
          slotProps={{ inputLabel: { shrink: true } }}
          required
          fullWidth
        />
      </Stack>
      <Controller
        control={control}
        name="tags"
        render={({ field }) => (
          <Autocomplete
            {...autocompleteProps}
            multiple
            value={field.value}
            onChange={(_event, value) => {
              field.onChange(value.slice(0, EVENT_MAX_TAGS));
            }}
            getOptionLabel={(tag) => tag.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                // MUI's own params type has optional props that exactOptionalPropertyTypes rejects.
                {...(params as TextFieldProps)}
                label={EVENT_FIELDS.tags.label}
                helperText={EVENT_FIELDS.tags.help}
              />
            )}
          />
        )}
      />
    </Stack>
  );
}
