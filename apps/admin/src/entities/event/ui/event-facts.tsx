import { EVENT_FIELDS, EVENT_PAGE_LABELS, formatPercent } from '@ers/shared';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import PlaceIcon from '@mui/icons-material/Place';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatDateTime } from '@/shared/lib/format';
import { FactCard } from '@/shared/ui/fact-card';
import { FillBar } from '@/shared/ui/fill-bar';

interface EventFactsProps {
  startsAt: string;
  endsAt: string;
  city: string;
  venue: string;
  organizerName: string;
  /** Shown to staff only; customers see seats per session instead. */
  seats?: { fillRate: number; confirmedCount: number; capacity: number };
}

function seatsTaken({
  confirmedCount,
  capacity,
}: {
  confirmedCount: number;
  capacity: number;
}): string {
  return `${String(confirmedCount)} of ${String(capacity)} seats`;
}

/** When, where and by whom an event is held (and, for staff, how full it is), as fact cards. */
export function EventFacts({
  startsAt,
  endsAt,
  city,
  venue,
  organizerName,
  seats,
}: EventFactsProps): React.JSX.Element {
  return (
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
      <FactCard
        icon={<EventIcon />}
        label={EVENT_PAGE_LABELS.when}
        value={formatDateTime(startsAt)}
        detail={`${EVENT_PAGE_LABELS.until} ${formatDateTime(endsAt)}`}
      />
      <FactCard icon={<PlaceIcon />} label={EVENT_PAGE_LABELS.where} value={city} detail={venue} />
      <FactCard icon={<PersonIcon />} label={EVENT_PAGE_LABELS.organizer} value={organizerName} />
      {seats !== undefined && (
        <FactCard
          icon={<TrendingUpIcon />}
          label={EVENT_FIELDS.fillRate.label}
          value={formatPercent(seats.fillRate)}
          detail={seatsTaken(seats)}
        >
          <FillBar
            rate={seats.fillRate}
            label={formatPercent(seats.fillRate)}
            name={EVENT_FIELDS.fillRate.label}
            showsLabel={false}
          />
        </FactCard>
      )}
    </Stack>
  );
}

/** An event's description under its label, kept as written (line breaks included). */
export function EventDescription({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  /** Extra lines under the text, such as tags. */
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <div>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-line' }}>{text}</Typography>
        </div>
        {children}
      </Stack>
    </Paper>
  );
}
