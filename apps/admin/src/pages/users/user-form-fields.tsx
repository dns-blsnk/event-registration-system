import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  OWN_ROLE_LOCKED_HELP,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROLE_LABELS,
  ROLES,
  USER_FIELDS,
} from '@ers/shared';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';

import { EMAIL_RULES, fieldHelp, REQUIRED, REQUIRED_TEXT } from '../../components/forms';

import type { UserFormValues } from './user-form-values';

interface UserFormFieldsProps {
  register: UseFormRegister<UserFormValues>;
  control: Control<UserFormValues>;
  errors: FieldErrors<UserFormValues>;
  isNew: boolean;
  /** Own account, or no change-role permission: the API would refuse, so the form does not offer it. */
  isRoleLocked: boolean;
}

const PASSWORD_RULES = {
  required: REQUIRED,
  minLength: { value: PASSWORD_MIN_LENGTH, message: USER_FIELDS.password.help },
};

/** The fields of the user form; email and password only when creating, limits from packages/shared. */
export function UserFormFields({
  register,
  control,
  errors,
  isNew,
  isRoleLocked,
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
            helperText={fieldHelp(
              errors.role,
              isRoleLocked ? OWN_ROLE_LOCKED_HELP : USER_FIELDS.role.help,
            )}
            error={errors.role !== undefined}
            disabled={isRoleLocked}
          >
            {ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      {isNew && (
        <TextField
          {...register('password', PASSWORD_RULES)}
          type="password"
          autoComplete="new-password"
          label={USER_FIELDS.password.label}
          helperText={fieldHelp(errors.password, USER_FIELDS.password.help)}
          error={errors.password !== undefined}
          slotProps={{ htmlInput: { maxLength: PASSWORD_MAX_LENGTH } }}
          required
        />
      )}
    </Stack>
  );
}
