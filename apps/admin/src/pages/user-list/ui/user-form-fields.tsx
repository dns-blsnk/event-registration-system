import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  OWN_ROLE_LOCKED_HELP,
  ROLE_LABELS,
  USER_FIELDS,
  type Role,
} from '@ers/shared';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';

import {
  EMAIL_RULES,
  fieldHelp,
  NEW_PASSWORD_RULES,
  REQUIRED_TEXT,
  SELECT_LABEL_PROPS,
} from '@/shared/lib/forms';

import type { UserFormValues } from '../model/user-form-values';

interface UserFormFieldsProps {
  register: UseFormRegister<UserFormValues>;
  control: Control<UserFormValues>;
  errors: FieldErrors<UserFormValues>;
  isNew: boolean;
  /** Own account, or no change-role permission: the API would refuse, so the form does not offer it. */
  isRoleLocked: boolean;
  /** The roles this viewer may give (plus the user's current one), from the shared rules. */
  roleOptions: readonly Role[];
}

/** The fields of the user form; email and password only when creating, limits from packages/shared. */
export function UserFormFields({
  register,
  control,
  errors,
  isNew,
  isRoleLocked,
  roleOptions,
}: UserFormFieldsProps): React.JSX.Element {
  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      {isNew && (
        <TextField
          {...register('email', EMAIL_RULES)}
          type="email"
          label={USER_FIELDS.email.label}
          helperText={fieldHelp(errors.email, USER_FIELDS.email.help)}
          error={errors.email !== undefined}
          slotProps={{ htmlInput: { maxLength: EMAIL_MAX_LENGTH } }}
          required
        />
      )}
      <TextField
        {...register('name', REQUIRED_TEXT)}
        label={USER_FIELDS.name.label}
        helperText={fieldHelp(errors.name, USER_FIELDS.name.help)}
        error={errors.name !== undefined}
        slotProps={{ htmlInput: { maxLength: NAME_MAX_LENGTH } }}
        required
      />
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <TextField
            {...field}
            select
            label={USER_FIELDS.role.label}
            slotProps={{ inputLabel: SELECT_LABEL_PROPS }}
            helperText={fieldHelp(
              errors.role,
              isRoleLocked ? OWN_ROLE_LOCKED_HELP : USER_FIELDS.role.help,
            )}
            error={errors.role !== undefined}
            disabled={isRoleLocked}
          >
            {roleOptions.map((role) => (
              <MenuItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      {isNew && (
        <TextField
          {...register('password', NEW_PASSWORD_RULES)}
          type="password"
          autoComplete="new-password"
          label={USER_FIELDS.password.label}
          helperText={fieldHelp(errors.password, USER_FIELDS.password.help)}
          error={errors.password !== undefined}
          required
        />
      )}
    </Stack>
  );
}
