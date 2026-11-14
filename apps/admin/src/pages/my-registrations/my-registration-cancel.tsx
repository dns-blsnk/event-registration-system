import { canCustomerCancel, Resource, type MyRegistration } from '@ers/shared';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useCustomMutation, useInvalidate } from '@refinedev/core';
import { useState } from 'react';

/** Whether the Cancel button is offered: the shared customer rule on this booking's session. */
export function canCancel(registration: MyRegistration, now: Date): boolean {
  const session = {
    startsAt: new Date(registration.session.startsAt),
    endsAt: new Date(registration.session.endsAt),
  };
  return canCustomerCancel(registration, session, now);
}

/** Cancel one's own booking after a confirmation; a freed seat goes to the waitlist at once. */
export function MyRegistrationCancel({
  registration,
}: {
  registration: MyRegistration;
}): React.JSX.Element {
  const { mutate, mutation } = useCustomMutation<MyRegistration>();
  const invalidate = useInvalidate();
  const [isConfirming, setConfirming] = useState(false);
  const cancel = (): void => {
    setConfirming(false);
    mutate(
      {
        url: `/my-registrations/${registration.id}/cancel`,
        method: 'post',
        values: {},
        successNotification: { type: 'success', message: 'Booking cancelled' },
      },
      {
        onSuccess: () => {
          void invalidate({ resource: Resource.MY_REGISTRATIONS, invalidates: ['list'] });
          void invalidate({
            resource: Resource.CATALOG,
            id: registration.event.id,
            invalidates: ['list', 'detail'],
          });
        },
      },
    );
  };
  return (
    <>
      <Button
        size="small"
        color="error"
        disabled={mutation.isPending || mutation.isSuccess}
        onClick={() => {
          setConfirming(true);
        }}
        aria-label={`Cancel booking for ${registration.session.title}`}
      >
        Cancel
      </Button>
      <Dialog
        open={isConfirming}
        onClose={() => {
          setConfirming(false);
        }}
      >
        <DialogTitle>Cancel this booking?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {registration.session.title} at {registration.event.title}. Your place goes to the next
            person on the waitlist. You can book again later if seats are free.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConfirming(false);
            }}
          >
            Keep booking
          </Button>
          <Button color="error" onClick={cancel}>
            Cancel booking
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
