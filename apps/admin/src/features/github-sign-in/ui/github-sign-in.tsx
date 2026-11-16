import { AUTH_PROVIDER_PATHS, type AuthProviders } from '@ers/shared';
import GitHubIcon from '@mui/icons-material/GitHub';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCustom } from '@refinedev/core';

import { API_BASE_URL } from '@/shared/api';

/** A full page load, not an API call: the API redirects the browser on to GitHub. */
export const GITHUB_SIGN_IN_URL = `${API_BASE_URL}${AUTH_PROVIDER_PATHS.github}`;

/**
 * An "or" line and the GitHub button after the email form, shown only when the API enables
 * GitHub. Below the form, so the form does not move when the answer arrives. Signing in and
 * signing up are the same flow: an unknown GitHub account gets a new customer account.
 */
export function GithubSignIn({ label }: { label: string }): React.JSX.Element | null {
  const { query } = useCustom<AuthProviders>({
    url: AUTH_PROVIDER_PATHS.providers,
    method: 'get',
    // Optional: if the API cannot say, email sign-in still works and the button stays hidden.
    errorNotification: false,
  });
  if (query.data?.data.github !== true) return null;
  return (
    <Stack spacing={3}>
      <Divider>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          or
        </Typography>
      </Divider>
      <Button
        variant="outlined"
        size="large"
        fullWidth
        startIcon={<GitHubIcon />}
        href={GITHUB_SIGN_IN_URL}
      >
        {label}
      </Button>
    </Stack>
  );
}
