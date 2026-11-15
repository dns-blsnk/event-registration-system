import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router';

/** A table cell's text as a link to that record's page, so the name itself is the way in. */
export function RowLink({ to, children }: { to: string; children: string }): React.JSX.Element {
  return (
    <Link component={RouterLink} to={to} underline="hover">
      {children}
    </Link>
  );
}
