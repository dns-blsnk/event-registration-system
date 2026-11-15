import { seatsLeftLabel, SESSION_FIELDS, type CatalogSession } from '@ers/shared';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { catalogSessionAnchor } from '@/entities/session';
import { formatDateTime } from '@/shared/lib/format';
import { FillBar } from '@/shared/ui/fill-bar';

import { SessionBooking } from './session-booking';

/** One session of the event with its booking button; outlined when a link led straight to it. */
export function CatalogSessionCard({
  session,
  eventId,
  eventTitle,
  isTargeted,
}: {
  session: CatalogSession;
  eventId: string;
  eventTitle: string;
  isTargeted: boolean;
}): React.JSX.Element {
  return (
    <Paper
      id={catalogSessionAnchor(session.id)}
      variant="outlined"
      sx={{ p: 2, ...(isTargeted ? { borderColor: 'primary.main', borderWidth: 2 } : {}) }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
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
          <SessionBooking session={session} eventId={eventId} eventTitle={eventTitle} />
        </Box>
      </Stack>
    </Paper>
  );
}
