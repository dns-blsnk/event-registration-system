import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from '@ers/shared';
import Chip from '@mui/material/Chip';

/** The one way a registration status is shown. */
export function RegistrationStatusChip({
  status,
}: {
  status: RegistrationStatus;
}): React.JSX.Element {
  return <Chip size="small" label={REGISTRATION_STATUS_LABELS[status]} />;
}
