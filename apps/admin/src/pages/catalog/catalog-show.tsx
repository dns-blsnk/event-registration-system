import {
  CATALOG_FIELDS,
  seatsLeftLabel,
  SESSION_FIELDS,
  type CatalogEventDetail,
} from '@ers/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useShow } from '@refinedev/core';
import { Show } from '@refinedev/mui';

import { EventDescription, EventFacts } from '../../components/event-facts';
import { EventHero } from '../../components/event-hero';
import { FillBar } from '../../components/fill-bar';
import { formatDateTime } from '../../components/format';

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
          <EventHero title={event.title} bannerUrl={event.bannerUrl} />
          <EventFacts
            startsAt={event.startsAt}
            endsAt={event.endsAt}
            city={event.city}
            venue={event.venue}
            organizerName={event.organizerName}
          />
          <EventDescription label={CATALOG_FIELDS.description.label} text={event.description} />
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
                    {` · ${String(session.capacity)} seats`}
                  </Typography>
                  <Box sx={{ maxWidth: 260, mt: 1 }}>
                    <FillBar
                      rate={session.fillRate}
                      label={seatsLeftLabel(session.seatsLeft)}
                      name={SESSION_FIELDS.seatsLeft.label}
                    />
                  </Box>
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
