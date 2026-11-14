import Link from '@mui/material/Link';
import { AuthPage } from '@refinedev/mui';
import { Link as RouterLink } from 'react-router';

import { REGISTER_PATH } from '../../providers/auth-provider';

/** Email and password sign-in, from Refine's MUI auth page. */
export function LoginPage(): React.JSX.Element {
  return (
    <AuthPage
      type="login"
      title="Event Registration"
      rememberMe={false}
      forgotPasswordLink={false}
      registerLink={
        <Link component={RouterLink} to={REGISTER_PATH} variant="body2">
          Create an account
        </Link>
      }
    />
  );
}
