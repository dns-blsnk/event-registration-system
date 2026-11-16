import {
  EMAIL_MAX_LENGTH,
  GITHUB_SIGN_IN_ERROR_PARAM,
  GITHUB_SIGN_IN_ERRORS,
  isGithubSignInError,
  SIGNUP_FIELDS,
} from '@ers/shared';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useLogin } from '@refinedev/core';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useSearchParams } from 'react-router';

import { GithubSignIn } from '@/features/github-sign-in';
import { REGISTER_PATH } from '@/shared/config';
import { EMAIL_RULES, REQUIRED } from '@/shared/lib/forms';
import { AuthLayout } from '@/shared/ui/auth-layout';
import { PasswordField } from '@/shared/ui/password-field';

interface LoginValues {
  email: string;
  password: string;
}

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

/**
 * Email and password sign-in, plus GitHub when the API enables it. A refused sign-in shows as
 * Refine's error notification; the auth provider does not say which field was wrong on purpose.
 */
export function LoginPage(): React.JSX.Element {
  const { mutate: signIn, isPending } = useLogin<LoginValues>();
  const githubError = useGithubSignInError();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ defaultValues: { email: '', password: '' } });
  const submit = handleSubmit((values) => {
    signIn({ ...values, email: values.email.trim() });
  });
  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to manage events and your bookings."
      footer={
        <>
          New here?{' '}
          <Link component={RouterLink} to={REGISTER_PATH}>
            Create an account
          </Link>
        </>
      }
    >
      {githubError.message !== undefined && (
        <Alert severity="error" onClose={githubError.dismiss}>
          {githubError.message}
        </Alert>
      )}
      <Stack component="form" noValidate spacing={2} onSubmit={(event) => void submit(event)}>
        <TextField
          {...register('email', EMAIL_RULES)}
          type="email"
          label={SIGNUP_FIELDS.email.label}
          helperText={errors.email?.message}
          error={errors.email !== undefined}
          autoComplete="email"
          slotProps={{ htmlInput: { maxLength: EMAIL_MAX_LENGTH } }}
          required
        />
        <PasswordField
          {...register('password', { required: REQUIRED })}
          label={SIGNUP_FIELDS.password.label}
          helperText={errors.password?.message}
          error={errors.password !== undefined}
          autoComplete="current-password"
          required
        />
        <Button type="submit" variant="contained" size="large" loading={isPending}>
          Sign in
        </Button>
      </Stack>
      <GithubSignIn label="Sign in with GitHub" />
    </AuthLayout>
  );
}
