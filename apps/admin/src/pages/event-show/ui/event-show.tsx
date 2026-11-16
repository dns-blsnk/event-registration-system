import { EVENT_FIELDS, isEventLocked, type EventDetail } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useShow } from '@refinedev/core';
import { EditButton, Show } from '@refinedev/mui';

import { EventDescription, EventFacts, EventHero, EventStatusChip } from '@/entities/event';
import { PinButton } from '@/features/pin-event';

import { EventActions } from './event-actions';
import { EventSessions } from './event-sessions';

/** One event: its details, banner, tags, lifecycle actions and the sessions inside it. */
export function EventShow(): React.JSX.Element {
  const { query } = useShow<EventDetail>();
  const event = query.data?.data;
  return (
    <Show
      isLoading={query.isLoading}
      headerButtons={
        event === undefined ? (
          []
        ) : (
          <>
            <PinButton eventId={event.id} title={event.title} />
            {!isEventLocked(event.status) && <EditButton recordItemId={event.id} />}
            <EventActions event={event} />
          </>
        )
      }
    >
      {query.isError && (
        <Alert severity="error">
          This event could not be loaded. It may not exist or belong to another organizer.
        </Alert>
      )}
      {event !== undefined && (
        <Stack spacing={3}>
          <EventHero
            title={event.title}
            bannerUrl={event.bannerUrl}
            status={<EventStatusChip status={event.status} />}
            statusLabel={EVENT_FIELDS.status.label}
          />
          <EventFacts
            startsAt={event.startsAt}
            endsAt={event.endsAt}
            city={event.city}
            venue={event.venue}
            organizerName={event.organizer.name}
            seats={event}
          />
          <EventDescription label={EVENT_FIELDS.description.label} text={event.description}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {EVENT_FIELDS.tags.label}
              </Typography>
              {event.tags.length === 0 ? (
                <Typography variant="body2">—</Typography>
              ) : (
                event.tags.map((tag) => (
                  <Chip key={tag.id} size="small" variant="outlined" label={tag.name} />
                ))
              )}
            </Stack>
          </EventDescription>
          <Box>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              Sessions
            </Typography>
            <EventSessions eventId={event.id} canChange={!isEventLocked(event.status)} />
          </Box>
        </Stack>
      )}
    </Show>
  );
}
