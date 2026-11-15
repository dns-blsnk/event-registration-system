import {
  canCustomerCancel,
  HELD_REGISTRATION_STATUSES,
  RegistrationStatus,
  Resource,
  SessionPhase,
  sessionPhase,
  type CatalogSession,
  type MyRegistration,
} from '@ers/shared';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { useCustomMutation, useInvalidate, useNotification } from '@refinedev/core';

import { RegistrationStatusChip } from '@/entities/registration';
import { CancelBookingButton, useCancelBooking } from '@/features/cancel-booking';
import { undoNoticeKey } from '@/shared/lib/undo-notice';

/** How long a new booking can be undone from its notification, for a click that was a slip. */
const UNDO_SECONDS = 5;

function bookedMessage(registration: MyRegistration): string {
  if (registration.status !== RegistrationStatus.WAITLISTED) return 'Seat booked';
  return registration.waitlistPosition === null
    ? 'Added to the waitlist'
    : `You are number ${String(registration.waitlistPosition)} on the waitlist`;
}

function sessionTimes(session: CatalogSession): { startsAt: Date; endsAt: Date } {
  return { startsAt: new Date(session.startsAt), endsAt: new Date(session.endsAt) };
}

function closedLabel(session: CatalogSession): string {
  return sessionPhase(sessionTimes(session), new Date()) === SessionPhase.ENDED
    ? 'Ended'
    : 'Started';
}

/**
 * What the customer can do with one session: see their booking, or book a seat (or a waitlist
 * place when it is full). The server decides seat or waitlist and re-checks every rule.
 */
export function SessionBooking({
  session,
  eventId,
  eventTitle,
}: {
  session: CatalogSession;
  eventId: string;
  eventTitle: string;
}): React.JSX.Element {
  const { mutate, mutation } = useCustomMutation<MyRegistration>();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const { cancel } = useCancelBooking();
  const held = session.myRegistration;
  if (held !== null && HELD_REGISTRATION_STATUSES.includes(held.status)) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <RegistrationStatusChip status={held.status} isOwn />
        {/* The same shared rule as on "My registrations": a seat or waitlist place, not started. */}
        {canCustomerCancel(held, sessionTimes(session), new Date()) && (
          <CancelBookingButton
            booking={{ registrationId: held.id, eventId }}
            sessionTitle={session.title}
            eventTitle={eventTitle}
          />
        )}
      </Stack>
    );
  }
  if (!session.isUpcoming) {
    return <Chip size="small" label={closedLabel(session)} />;
  }
  const book = (): void => {
    mutate(
      {
        url: '/my-registrations',
        method: 'post',
        values: { sessionId: session.id },
        // Said by the notification below instead, which can also undo the booking.
        successNotification: false,
      },
      {
        onSuccess: ({ data }) => {
          // The seat is held at once (no one can take it meanwhile); Undo cancels it again.
          open?.({
            key: undoNoticeKey(data.id),
            type: 'progress',
            message: bookedMessage(data),
            undoableTimeout: UNDO_SECONDS,
            cancelMutation: () => {
              mutation.reset();
              cancel({ registrationId: data.id, eventId }, 'Booking undone');
            },
          });
          // Seat totals change in the list too, not only on this page.
          void invalidate({
            resource: Resource.CATALOG,
            id: eventId,
            invalidates: ['list', 'detail'],
          });
          void invalidate({ resource: Resource.MY_REGISTRATIONS, invalidates: ['list'] });
        },
      },
    );
  };
  return (
    <Button
      variant="contained"
      size="small"
      // Stays off after success until the refetched page shows the booking, so it cannot be sent twice.
      disabled={mutation.isPending || mutation.isSuccess}
      onClick={book}
      aria-label={`Book ${session.title}`}
    >
      {session.seatsLeft === 0 ? 'Join waitlist' : 'Book seat'}
    </Button>
  );
}
