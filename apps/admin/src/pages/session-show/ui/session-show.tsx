import { SESSION_FIELDS, type SessionListItem } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useShow } from '@refinedev/core';
import { Show } from '@refinedev/mui';
import { Link as RouterLink } from 'react-router';

import { formatDateTime } from '@/shared/lib/format';
import { LabelledValue } from '@/shared/ui/labelled-value';
import { RegistrationTable } from '@/widgets/registration-table';

/** One session: its time, seats and waitlist, and below it the registrations made for it. */
export function SessionShow(): React.JSX.Element {
  // The page explains a missing session itself; no second message as a toast.
  const { query } = useShow<SessionListItem>({ errorNotification: false });
  const session = query.data?.data;
  return (
    <Show isLoading={query.isLoading} canEdit={false} canDelete={false}>
      {query.isError && session === undefined && (
        <Alert severity="error">
          This session could not be loaded. It may not exist or belong to another organizer.
        </Alert>
      )}
      {session !== undefined && (
        <Stack spacing={3}>
          <Typography variant="h5" component="h2">
            {session.title}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} useFlexGap flexWrap="wrap">
            <LabelledValue label={SESSION_FIELDS.event.label}>
              <Link component={RouterLink} to={`/events/${session.eventId}`}>
                {session.eventTitle}
              </Link>
            </LabelledValue>
            <LabelledValue label={SESSION_FIELDS.startsAt.label}>
              {formatDateTime(session.startsAt)}
            </LabelledValue>
            <LabelledValue label={SESSION_FIELDS.endsAt.label}>
              {formatDateTime(session.endsAt)}
            </LabelledValue>
            <LabelledValue label={SESSION_FIELDS.speaker.label}>
              {session.speaker ?? '—'}
            </LabelledValue>
            <LabelledValue label={SESSION_FIELDS.room.label}>{session.room ?? '—'}</LabelledValue>
            <LabelledValue label={SESSION_FIELDS.capacity.label}>
              {String(session.capacity)}
            </LabelledValue>
            <LabelledValue label={SESSION_FIELDS.seatsLeft.label}>
              {String(session.seatsLeft)}
            </LabelledValue>
            <LabelledValue label={SESSION_FIELDS.waitlistCount.label}>
              {String(session.waitlistCount)}
            </LabelledValue>
          </Stack>
          <Typography variant="h6" component="h3">
            Registrations
          </Typography>
          <RegistrationTable sessionId={session.id} />
        </Stack>
      )}
    </Show>
  );
}
