import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useState } from 'react';

import { useCancelBooking, type BookingRef } from '../model/use-cancel-booking';

/** Cancel one's own booking after a confirmation; a freed seat goes to the waitlist at once. */
export function CancelBookingButton({
  booking,
  sessionTitle,
  eventTitle,
}: {
  booking: BookingRef;
  sessionTitle: string;
  eventTitle: string;
}): React.JSX.Element {
  const { cancel, isPending, isDone } = useCancelBooking();
  const [isConfirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        size="small"
        color="error"
        disabled={isPending || isDone}
        onClick={() => {
          setConfirming(true);
        }}
        aria-label={`Cancel booking for ${sessionTitle}`}
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
            {sessionTitle} at {eventTitle}. Your place goes to the next person on the waitlist. You
            can book again later if seats are free.
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
          <Button
            color="error"
            onClick={() => {
              setConfirming(false);
              cancel(booking);
            }}
          >
            Cancel booking
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
