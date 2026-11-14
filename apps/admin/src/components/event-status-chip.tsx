import { EVENT_STATUS_LABELS, type EventStatus } from '@ers/shared';
import Chip from '@mui/material/Chip';

/** The one way an event status is shown, in lists and on the event page alike. */
export function EventStatusChip({ status }: { status: EventStatus }): React.JSX.Element {
  return <Chip size="small" label={EVENT_STATUS_LABELS[status]} />;
}
