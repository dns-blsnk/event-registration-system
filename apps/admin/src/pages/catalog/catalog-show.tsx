import { EVENT_FIELDS, SESSION_FIELDS, type CatalogEventDetail } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useShow } from '@refinedev/core';
import { Show } from '@refinedev/mui';

import { formatDateTime } from '../../components/format';
import { LabelledValue } from '../../components/labelled-value';

import { SessionBooking } from './session-booking';

/** One published event for a customer: details, then each session with its booking button. */
export function CatalogShow(): React.JSX.Element {
  // The page explains a missing event itself; no second message as a toast.
  const { query } = useShow<CatalogEventDetail>({ errorNotification: false });
  const event = query.data?.data;
  return (
    <Show isLoading={query.isLoading} title="Event" canEdit={false} canDelete={false}>
      {query.isError && event === undefined && (
        <Alert severity="error">This event is not available.</Alert>
      )}
      {event !== undefined && (
        <Stack spacing={3}>
          {event.bannerUrl !== null && (
            <Box
              component="img"
              src={event.bannerUrl}
              alt={`Banner of ${event.title}`}
              sx={{ maxWidth: '100%', borderRadius: 1 }}
            />
          )}
          <Typography variant="h5" component="h2">
            {event.title}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} useFlexGap flexWrap="wrap">
            <LabelledValue label={EVENT_FIELDS.startsAt.label}>
              {formatDateTime(event.startsAt)}
            </LabelledValue>
            <LabelledValue label={EVENT_FIELDS.endsAt.label}>
              {formatDateTime(event.endsAt)}
            </LabelledValue>
            <LabelledValue label={EVENT_FIELDS.city.label}>{event.city}</LabelledValue>
            <LabelledValue label={EVENT_FIELDS.venue.label}>{event.venue}</LabelledValue>
            <LabelledValue label={EVENT_FIELDS.organizer.label}>
              {event.organizerName}
            </LabelledValue>
          </Stack>
          <Typography sx={{ whiteSpace: 'pre-line' }}>{event.description}</Typography>
          <Typography variant="h6" component="h3">
            Sessions
          </Typography>
          {event.sessions.length === 0 && (
            <Typography>No sessions have been announced yet.</Typography>
          )}
          {event.sessions.map((session) => (
            <Paper key={session.id} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent="space-between"
              >
                <Box>
                  <Typography fontWeight="bold">{session.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDateTime(session.startsAt)} – {formatDateTime(session.endsAt)}
                    {session.room === null ? '' : ` · ${session.room}`}
                    {session.speaker === null ? '' : ` · ${session.speaker}`}
                  </Typography>
                  <Typography variant="body2">
                    {SESSION_FIELDS.seatsLeft.label}: {String(session.seatsLeft)} of{' '}
                    {String(session.capacity)}
                  </Typography>
                </Box>
                <Box sx={{ alignSelf: { sm: 'center' } }}>
                  <SessionBooking session={session} eventId={event.id} />
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Show>
  );
}
