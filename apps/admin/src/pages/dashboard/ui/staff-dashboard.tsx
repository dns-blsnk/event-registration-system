import {
  ALMOST_FULL_FILTER,
  APP_LOG_RETENTION_DAYS,
  AppLogCategory,
  EventStatus,
  hasAdminPowers,
  MAX_PINNED_EVENTS,
  Resource,
  type Role,
} from '@ers/shared';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { usePinnedEvents } from '@/features/pin-event';

import { listUrl } from '../lib/list-url';

import { PinnedEventCard } from './pinned-event-card';
import { StatTile } from './stat-tile';

const PINNED_GRID_COLUMNS = 'repeat(auto-fill, minmax(300px, 1fr))';

function StaffStats({ role }: { role: Role }): React.JSX.Element {
  return (
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
      <StatTile
        label="Published events"
        icon={<EventAvailableIcon />}
        resource={Resource.EVENTS}
        filters={[{ field: 'status', operator: 'eq', value: EventStatus.PUBLISHED }]}
        to={listUrl('/events', { status: EventStatus.PUBLISHED })}
        color="primary"
      />
      <StatTile
        label="Drafts"
        icon={<EditNoteIcon />}
        resource={Resource.EVENTS}
        filters={[{ field: 'status', operator: 'eq', value: EventStatus.DRAFT }]}
        to={listUrl('/events', { status: EventStatus.DRAFT })}
        color="secondary"
      />
      <StatTile
        label="Almost full sessions"
        icon={<WhatshotIcon />}
        resource={Resource.SESSIONS}
        filters={[
          { field: ALMOST_FULL_FILTER.field, operator: 'eq', value: ALMOST_FULL_FILTER.value },
        ]}
        to={listUrl('/sessions', { [ALMOST_FULL_FILTER.field]: ALMOST_FULL_FILTER.value })}
        color="warning"
      />
      {hasAdminPowers(role) && (
        <StatTile
          // The whole journal (kept APP_LOG_RETENTION_DAYS), exactly what the link opens.
          label={`Errors, last ${String(APP_LOG_RETENTION_DAYS)} days`}
          icon={<ReportProblemIcon />}
          resource={Resource.APP_LOGS}
          filters={[{ field: 'category', operator: 'eq', value: AppLogCategory.ERROR }]}
          to={listUrl('/logs', { category: AppLogCategory.ERROR })}
          color="error"
        />
      )}
    </Stack>
  );
}

function PinnedEvents(): React.JSX.Element {
  const { events, isLoading } = usePinnedEvents();
  if (isLoading) return <Skeleton variant="rounded" height={120} />;
  if (events.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Pin events from the events list or an event page (the pin button) to follow them here, up
          to {String(MAX_PINNED_EVENTS)}.
        </Typography>
      </Paper>
    );
  }
  return (
    // A grid, so one pinned event is a card, not a full-width strip.
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: PINNED_GRID_COLUMNS }}>
      {events.map((event) => (
        <PinnedEventCard key={event.id} event={event} />
      ))}
    </Box>
  );
}

/** Admins and organizers: key numbers (each opens its list), then the events they pinned. */
export function StaffDashboard({ role }: { role: Role }): React.JSX.Element {
  return (
    <Stack spacing={3}>
      <StaffStats role={role} />
      <Stack spacing={1.5}>
        <Typography variant="h6" component="h2">
          Pinned events
        </Typography>
        <PinnedEvents />
      </Stack>
    </Stack>
  );
}
