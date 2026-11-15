import { EVENT_STATUS_LABELS, type EventStatus } from '@ers/shared';

import { EVENT_STATUS_COLORS } from '@/shared/theme';
import { StatusChip } from '@/shared/ui/status-chip';

/** The one way an event status is shown, in lists and on the event page alike. */
export function EventStatusChip({ status }: { status: EventStatus }): React.JSX.Element {
  return <StatusChip label={EVENT_STATUS_LABELS[status]} color={EVENT_STATUS_COLORS[status]} />;
}
