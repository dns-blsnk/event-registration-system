import {
  AUTH_PROVIDER_PATHS,
  GITHUB_SIGN_IN_ERROR_PARAM,
  GITHUB_SIGN_IN_ERRORS,
  isGithubSignInError,
  type AuthProviders,
} from '@ers/shared';
import GitHubIcon from '@mui/icons-material/GitHub';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { useCustom } from '@refinedev/core';
import { AuthPage } from '@refinedev/mui';
import { Link as RouterLink, useSearchParams } from 'react-router';

import { API_BASE_URL } from '../../api/http';
import { REGISTER_PATH } from '../../providers/auth-provider';

/** A full page load, not an API call: the API redirects the browser on to GitHub. */
export const GITHUB_SIGN_IN_URL = `${API_BASE_URL}${AUTH_PROVIDER_PATHS.github}`;
/** Width of Refine's auth card, so the error lines up with it. */
const AUTH_CARD_WIDTH = 400;

/**
 * Why the last GitHub sign-in failed (only known reasons, never text taken from the URL), and a
 * way to dismiss it, which also drops it from the URL.
 */
function useGithubSignInError(): { message: string | undefined; dismiss: () => void } {
  const [params, setParams] = useSearchParams();
  const error = params.get(GITHUB_SIGN_IN_ERROR_PARAM);
  const dismiss = (): void => {
    setParams(
      (current) => {
        current.delete(GITHUB_SIGN_IN_ERROR_PARAM);
        return current;
      },
      { replace: true },
    );
  };
  return {
    message: isGithubSignInError(error) ? GITHUB_SIGN_IN_ERRORS[error] : undefined,
    dismiss,
  };
}

/** Email and password sign-in from Refine's MUI auth page, plus GitHub when the API enables it. */
export function LoginPage(): React.JSX.Element {
  const { query } = useCustom<AuthProviders>({
    url: AUTH_PROVIDER_PATHS.providers,
    method: 'get',
    // Optional: if the API cannot say, email sign-in still works and the button stays hidden.
    errorNotification: false,
  });
  const isGithubEnabled = query.data?.data.github === true;
  const githubError = useGithubSignInError();
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
      renderContent={(content, title) => (
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          {title}
          {githubError.message !== undefined && (
            <Alert
              severity="error"
              sx={{ maxWidth: AUTH_CARD_WIDTH }}
              onClose={githubError.dismiss}
            >
              {githubError.message}
            </Alert>
          )}
          {content}
          {isGithubEnabled && (
            <Button variant="outlined" startIcon={<GitHubIcon />} href={GITHUB_SIGN_IN_URL}>
              Sign in with GitHub
            </Button>
          )}
        </Stack>
      )}
    />
  );
}
