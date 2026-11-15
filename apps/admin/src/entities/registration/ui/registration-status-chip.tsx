import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from '@ers/shared';

import { REGISTRATION_STATUS_COLORS } from '@/shared/theme';
import { StatusChip } from '@/shared/ui/status-chip';

/** The one way a registration status is shown. */
export function RegistrationStatusChip({
  status,
  isOwn = false,
}: {
  status: RegistrationStatus;
  /** The viewer's own booking, highlighted where customers see it. */
  isOwn?: boolean;
}): React.JSX.Element {
  return (
    <StatusChip
      label={REGISTRATION_STATUS_LABELS[status]}
      color={REGISTRATION_STATUS_COLORS[status]}
      emphasis={isOwn}
    />
  );
}
