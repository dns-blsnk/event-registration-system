import { EVENT_FIELDS, formatPercent, type EventListItem } from '@ers/shared';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EventStatusChip } from '../../components/event-status-chip';
import { FillBar } from '../../components/fill-bar';
import { formatDateTime } from '../../components/format';
import { PinButton } from '../../components/pin-button';
import { RowLink } from '../../components/row-link';

/** A pinned event at a glance: status, when and where, and how full it is. */
export function PinnedEventCard({ event }: { event: EventListItem }): React.JSX.Element {
  return (
    <Card sx={{ p: 2, minWidth: 0 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Typography variant="subtitle1" component="h3" fontWeight={700} sx={{ minWidth: 0 }}>
            <RowLink to={`/events/${event.id}`}>{event.title}</RowLink>
          </Typography>
          <PinButton eventId={event.id} title={event.title} />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <EventStatusChip status={event.status} />
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(event.startsAt)} · {event.city}
          </Typography>
        </Stack>
        <FillBar
          rate={event.fillRate}
          label={formatPercent(event.fillRate)}
          name={EVENT_FIELDS.fillRate.label}
        />
      </Stack>
    </Card>
  );
}
