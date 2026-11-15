import { Action, Resource, type UserListItem } from '@ers/shared';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useCan, useInvalidateAuthStore } from '@refinedev/core';
import { useForm } from '@refinedev/react-hook-form';

import { forgetCachedUser } from '@/entities/viewer';
import { submitConverted } from '@/shared/lib/forms';

import {
  EMPTY_USER_FORM,
  toUserCreatePayload,
  toUserFormValues,
  toUserPatch,
  type UserFormValues,
} from '../model/user-form-values';

import { UserFormFields } from './user-form-fields';

import type { HttpError } from '@refinedev/core';

interface UserFormDialogProps {
  /** The user to edit; undefined to create one. */
  user: UserListItem | undefined;
  isSelf: boolean;
  onClose: () => void;
}

/** Create a user, or change a user's name and role, in a dialog over the users list. */
export function UserFormDialog({ user, isSelf, onClose }: UserFormDialogProps): React.JSX.Element {
  const { data: roleAccess } = useCan({ resource: Resource.USERS, action: Action.CHANGE_ROLE });
  const invalidateAuth = useInvalidateAuthStore();
  const original = user === undefined ? EMPTY_USER_FORM : toUserFormValues(user);
  const {
    refineCore: { onFinish, formLoading },
    handleSubmit,
    register,
    control,
    formState: { errors },
  } = useForm<UserListItem, HttpError, UserFormValues>({
    defaultValues: original,
    refineCoreProps: {
      resource: Resource.USERS,
      action: user === undefined ? 'create' : 'edit',
      ...(user === undefined ? {} : { id: user.id }),
      queryOptions: { enabled: false },
      redirect: false,
      onMutationSuccess: () => {
        // A renamed own account must show the new name in the header too.
        if (isSelf) {
          forgetCachedUser();
          void invalidateAuth();
        }
        onClose();
      },
    },
    warnWhenUnsavedChanges: false,
  });
  const save = handleSubmit(async (values) => {
    if (user === undefined) {
      await submitConverted(onFinish, toUserCreatePayload(values));
      return;
    }
    const patch = toUserPatch(values, original);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    await submitConverted(onFinish, patch);
  });
  const title = user === undefined ? 'Add user' : 'Edit user';
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="user-form-title">
      <form noValidate onSubmit={(event) => void save(event)}>
        <DialogTitle id="user-form-title">{title}</DialogTitle>
        <DialogContent>
          <UserFormFields
            register={register}
            control={control}
            errors={errors}
            isNew={user === undefined}
            isRoleLocked={isSelf || roleAccess?.can !== true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={formLoading}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
