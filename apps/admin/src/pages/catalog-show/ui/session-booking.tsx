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
import { useCustomMutation, useInvalidate } from '@refinedev/core';

import { RegistrationStatusChip } from '@/entities/registration';
import { CancelBookingButton } from '@/features/cancel-booking';

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
        successNotification: (response) => ({
          type: 'success',
          message: response === undefined ? 'Booking saved' : bookedMessage(response.data),
        }),
      },
      {
        onSuccess: () => {
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
