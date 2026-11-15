import {
  SESSION_FIELDS,
  SESSION_MAX_CAPACITY,
  SESSION_ROOM_MAX_LENGTH,
  SESSION_SPEAKER_MAX_LENGTH,
  SESSION_TITLE_MAX_LENGTH,
} from '@ers/shared';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import { REQUIRED_DATE_SX } from '@/shared/lib/date-input';
import { fieldHelp, REQUIRED, REQUIRED_TEXT } from '@/shared/lib/forms';

import type { SessionFormValues } from '../model/session-form-values';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

interface SessionFormFieldsProps {
  register: UseFormRegister<SessionFormValues>;
  errors: FieldErrors<SessionFormValues>;
  /** A running session keeps its time and capacity; only its texts can change. */
  isScheduleLocked: boolean;
}

const CAPACITY_RULES = {
  required: REQUIRED,
  validate: (value: string): true | string => {
    const capacity = Number(value);
    return (
      (Number.isInteger(capacity) && capacity >= 1 && capacity <= SESSION_MAX_CAPACITY) ||
      `A whole number from 1 to ${String(SESSION_MAX_CAPACITY)}`
    );
  },
};

const ENDS_RULES = {
  required: REQUIRED,
  validate: (endsAt: string, values: SessionFormValues): true | string =>
    values.startsAt === '' || endsAt > values.startsAt || 'The end must be after the start',
};

const SCHEDULE_LOCKED_HELP = 'Fixed once the session has started.';

const DATE_INPUT = { inputLabel: { shrink: true } } as const;

/** The fields of the session form; limits and texts come from packages/shared. */
export function SessionFormFields({
  register,
  errors,
  isScheduleLocked,
}: SessionFormFieldsProps): React.JSX.Element {
  const scheduleHelp = (error: { message?: string } | undefined, description: string): string =>
    fieldHelp(error, isScheduleLocked ? SCHEDULE_LOCKED_HELP : description);
  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <TextField
        {...register('title', REQUIRED_TEXT)}
        label={SESSION_FIELDS.title.label}
        helperText={fieldHelp(errors.title, SESSION_FIELDS.title.help)}
        error={errors.title !== undefined}
        slotProps={{ htmlInput: { maxLength: SESSION_TITLE_MAX_LENGTH } }}
        required
      />
      <TextField
        {...register('speaker')}
        label={SESSION_FIELDS.speaker.label}
        helperText={fieldHelp(errors.speaker, SESSION_FIELDS.speaker.help)}
        error={errors.speaker !== undefined}
        slotProps={{ htmlInput: { maxLength: SESSION_SPEAKER_MAX_LENGTH } }}
      />
      <TextField
        {...register('room')}
        label={SESSION_FIELDS.room.label}
        helperText={fieldHelp(errors.room, SESSION_FIELDS.room.help)}
        error={errors.room !== undefined}
        slotProps={{ htmlInput: { maxLength: SESSION_ROOM_MAX_LENGTH } }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          {...register('startsAt', { required: REQUIRED })}
          type="datetime-local"
          sx={REQUIRED_DATE_SX}
          label={SESSION_FIELDS.startsAt.label}
          helperText={scheduleHelp(errors.startsAt, SESSION_FIELDS.startsAt.help)}
          disabled={isScheduleLocked}
          error={errors.startsAt !== undefined}
          slotProps={DATE_INPUT}
          required
          fullWidth
        />
        <TextField
          {...register('endsAt', ENDS_RULES)}
          type="datetime-local"
          sx={REQUIRED_DATE_SX}
          label={SESSION_FIELDS.endsAt.label}
          helperText={scheduleHelp(errors.endsAt, SESSION_FIELDS.endsAt.help)}
          disabled={isScheduleLocked}
          error={errors.endsAt !== undefined}
          slotProps={DATE_INPUT}
          required
          fullWidth
        />
      </Stack>
      <TextField
        {...register('capacity', CAPACITY_RULES)}
        type="number"
        label={SESSION_FIELDS.capacity.label}
        helperText={scheduleHelp(errors.capacity, SESSION_FIELDS.capacity.help)}
        disabled={isScheduleLocked}
        error={errors.capacity !== undefined}
        slotProps={{ htmlInput: { min: 1, max: SESSION_MAX_CAPACITY, step: 1 } }}
        required
      />
    </Stack>
  );
}
