import { EVENT_FIELDS, isEventLocked, type EventDetail, formatPercent } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useShow } from '@refinedev/core';
import { EditButton, Show } from '@refinedev/mui';

import { EventStatusChip } from '../../components/event-status-chip';
import { formatDateTime } from '../../components/format';
import { LabelledValue } from '../../components/labelled-value';

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
            <LabelledValue label={EVENT_FIELDS.status.label}>
              <EventStatusChip status={event.status} />
            </LabelledValue>
            <LabelledValue label={EVENT_FIELDS.startsAt.label}>
              {formatDateTime(event.startsAt)}
            </LabelledValue>
            <LabelledValue label={EVENT_FIELDS.endsAt.label}>
              {formatDateTime(event.endsAt)}
            </LabelledValue>
            <LabelledValue label={EVENT_FIELDS.city.label}>{event.city}</LabelledValue>
            <LabelledValue label={EVENT_FIELDS.venue.label}>{event.venue}</LabelledValue>
            <LabelledValue label={EVENT_FIELDS.organizer.label}>
              {event.organizer.name}
            </LabelledValue>
            <LabelledValue label={EVENT_FIELDS.fillRate.label}>
              {formatPercent(event.fillRate)}
            </LabelledValue>
          </Stack>
          <LabelledValue label={EVENT_FIELDS.tags.label}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {event.tags.length === 0
                ? '—'
                : event.tags.map((tag) => <Chip key={tag.id} size="small" label={tag.name} />)}
            </Stack>
          </LabelledValue>
          <LabelledValue label={EVENT_FIELDS.description.label}>
            <Typography sx={{ whiteSpace: 'pre-line' }}>{event.description}</Typography>
          </LabelledValue>
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
