import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from '@ers/shared';
import Chip from '@mui/material/Chip';

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
    <Chip
      size="small"
      color={isOwn ? 'primary' : 'default'}
      label={REGISTRATION_STATUS_LABELS[status]}
    />
  );
}
