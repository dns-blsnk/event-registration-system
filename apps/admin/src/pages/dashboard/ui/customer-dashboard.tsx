import {
  Resource,
  type CatalogEventListItem,
  type MyRegistration,
  RegistrationStatus,
} from '@ers/shared';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useList } from '@refinedev/core';

import { RegistrationStatusChip } from '@/entities/registration';
import { formatDateTime } from '@/shared/lib/format';
import { RowLink } from '@/shared/ui/row-link';

/** How many rows each dashboard list shows; the full lists are one click away. */
const PREVIEW_SIZE = 5;
/** Bookings read to find the upcoming ones: the API orders them by booking time, not session. */
const BOOKINGS_SCAN_SIZE = 50;
const PREVIEW_SKELETON_HEIGHT = 120;

/** The next sessions the customer holds a seat in, soonest first. */
function upcoming(bookings: readonly MyRegistration[], now: Date): MyRegistration[] {
  return bookings
    .filter((booking) => new Date(booking.session.startsAt).getTime() > now.getTime())
    .sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt))
    .slice(0, PREVIEW_SIZE);
}

function Section({
  title,
  isLoading,
  empty,
  children,
}: {
  title: string;
  isLoading: boolean;
  empty: string | undefined;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card sx={{ p: 2, flex: '1 1 360px', minWidth: 0 }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {isLoading && <Skeleton variant="rounded" height={PREVIEW_SKELETON_HEIGHT} sx={{ mt: 1 }} />}
      {!isLoading && empty === undefined && <List dense>{children}</List>}
      {!isLoading && empty !== undefined && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {empty}
        </Typography>
      )}
    </Card>
  );
}

function MyBookings(): React.JSX.Element {
  const { result, query } = useList<MyRegistration>({
    resource: Resource.MY_REGISTRATIONS,
    filters: [{ field: 'status', operator: 'eq', value: RegistrationStatus.CONFIRMED }],
    pagination: { currentPage: 1, pageSize: BOOKINGS_SCAN_SIZE },
  });
  const next = upcoming(result.data, new Date());
  return (
    <Section
      title="Upcoming bookings"
      isLoading={query.isLoading}
      empty={next.length === 0 ? 'No upcoming bookings: find a session in the catalog.' : undefined}
    >
      {next.map((booking) => (
        // The chip sits in the row, not in `secondaryAction`: that one floats over the text and
        // keeps room for an icon only, so a long title ran under the wider chip.
        <ListItem key={booking.id} disableGutters sx={{ gap: 1 }}>
          <ListItemText
            primary={booking.session.title}
            secondary={`${booking.event.title} · ${formatDateTime(booking.session.startsAt)}`}
          />
          <Box sx={{ flexShrink: 0 }}>
            <RegistrationStatusChip status={booking.status} />
          </Box>
        </ListItem>
      ))}
    </Section>
  );
}

function ComingUp(): React.JSX.Element {
  const { result, query } = useList<CatalogEventListItem>({
    resource: Resource.CATALOG,
    sorters: [{ field: 'startsAt', order: 'asc' }],
    pagination: { currentPage: 1, pageSize: PREVIEW_SIZE },
  });
  return (
    <Section
      title="Coming up"
      isLoading={query.isLoading}
      empty={result.data.length === 0 ? 'No events are open for booking right now.' : undefined}
    >
      {result.data.map((event) => (
        <ListItem key={event.id} disableGutters>
          <ListItemText
            primary={<RowLink to={`/catalog/${event.id}`}>{event.title}</RowLink>}
            secondary={`${formatDateTime(event.startsAt)} · ${event.city}`}
          />
        </ListItem>
      ))}
    </Section>
  );
}

/** Customers: their confirmed bookings and the next events open for booking. */
export function CustomerDashboard(): React.JSX.Element {
  return (
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
      <MyBookings />
      <ComingUp />
    </Stack>
  );
}
