import { Resource, SessionPhase, sessionPhase, type SessionListItem } from '@ers/shared';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useForm } from '@refinedev/react-hook-form';

import { submitConverted } from '../../components/forms';

import { SessionFormFields } from './session-form-fields';
import {
  EMPTY_SESSION_FORM,
  isEmptyPatch,
  toSessionCreatePayload,
  toSessionFormValues,
  toSessionPatch,
  type SessionFormValues,
} from './session-form-values';

import type { HttpError } from '@refinedev/core';

/** Adding a session to an event, or editing one of its rows. */
export type SessionDialogTarget =
  { eventId: string; session?: undefined } | { eventId: string; session: SessionListItem };

interface SessionFormDialogProps {
  target: SessionDialogTarget;
  onClose: () => void;
}

/**
 * Session create and edit in a dialog on the event page, where sessions are managed. Editing starts
 * from the table row, so nothing is fetched again; the server re-checks every rule on save.
 */
export function SessionFormDialog({ target, onClose }: SessionFormDialogProps): React.JSX.Element {
  const { session, eventId } = target;
  const original = session === undefined ? EMPTY_SESSION_FORM : toSessionFormValues(session);
  const {
    refineCore: { onFinish, formLoading },
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<SessionListItem, HttpError, SessionFormValues>({
    defaultValues: original,
    refineCoreProps: {
      resource: Resource.SESSIONS,
      action: session === undefined ? 'create' : 'edit',
      ...(session === undefined ? {} : { id: session.id }),
      queryOptions: { enabled: false },
      redirect: false,
      onMutationSuccess: onClose,
    },
    warnWhenUnsavedChanges: false,
  });
  const isScheduleLocked =
    session !== undefined &&
    sessionPhase(
      { startsAt: new Date(session.startsAt), endsAt: new Date(session.endsAt) },
      new Date(),
    ) !== SessionPhase.UPCOMING;
  const save = handleSubmit(async (values) => {
    if (session === undefined) {
      await submitConverted(onFinish, toSessionCreatePayload(values, eventId));
      return;
    }
    const patch = toSessionPatch(values, original);
    // Nothing changed: no request, and no conflict from a save that would change nothing.
    if (isEmptyPatch(patch)) {
      onClose();
      return;
    }
    await submitConverted(onFinish, patch);
  });
  const title = session === undefined ? 'Add session' : 'Edit session';
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="session-form-title">
      <form noValidate onSubmit={(event) => void save(event)}>
        <DialogTitle id="session-form-title">{title}</DialogTitle>
        <DialogContent>
          <SessionFormFields
            register={register}
            errors={errors}
            isScheduleLocked={isScheduleLocked}
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
