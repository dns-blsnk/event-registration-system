import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, SIGNUP_FIELDS, type FieldError } from '@ers/shared';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useRegister } from '@refinedev/core';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router';

import { GithubSignIn } from '@/features/github-sign-in';
import { LOGIN_PATH } from '@/shared/config';
import { EMAIL_RULES, fieldHelp, NEW_PASSWORD_RULES, REQUIRED_TEXT } from '@/shared/lib/forms';
import { AuthLayout } from '@/shared/ui/auth-layout';
import { PasswordField } from '@/shared/ui/password-field';

interface SignupValues {
  name: string;
  email: string;
  password: string;
}

const SIGNUP_FIELD_NAMES: readonly string[] = ['name', 'email', 'password'];

function isSignupField(field: string): field is keyof SignupValues {
  return SIGNUP_FIELD_NAMES.includes(field);
}

/** Field details the auth provider passes along with a refused sign-up, if any. */
function detailsOf(error: unknown): FieldError[] {
  if (typeof error !== 'object' || error === null || !('details' in error)) return [];
  return Array.isArray(error.details) ? (error.details as FieldError[]) : [];
}

/**
 * Self sign-up. Refine's register AuthPage has no name field, which the API requires, so this is a
 * small form of its own. Accounts made here are always customers (the API sets the role). A refusal
 * shows as Refine's error notification, and field details from the API mark the fields. GitHub
 * sign-up is the same flow as GitHub sign-in.
 */
export function SignupPage(): React.JSX.Element {
  const { mutateAsync: signUp, isPending } = useRegister<SignupValues>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupValues>({ defaultValues: { name: '', email: '', password: '' } });
  const submit = handleSubmit(async (values) => {
    const result = await signUp({
      ...values,
      name: values.name.trim(),
      email: values.email.trim(),
    });
    for (const { field, messages } of detailsOf(result.error)) {
      if (isSignupField(field)) setError(field, { message: messages.join(' ') });
    }
  });
  return (
    <AuthLayout
      title="Create an account"
      subtitle="Book sessions and keep track of your registrations."
      footer={
        <>
          Already have an account?{' '}
          <Link component={RouterLink} to={LOGIN_PATH}>
            Sign in
          </Link>
        </>
      }
    >
      <Stack component="form" noValidate spacing={2} onSubmit={(event) => void submit(event)}>
        <TextField
          {...register('name', REQUIRED_TEXT)}
          label={SIGNUP_FIELDS.name.label}
          helperText={fieldHelp(errors.name, SIGNUP_FIELDS.name.help)}
          error={errors.name !== undefined}
          autoComplete="name"
          slotProps={{ htmlInput: { maxLength: NAME_MAX_LENGTH } }}
          required
        />
        <TextField
          {...register('email', EMAIL_RULES)}
          type="email"
          label={SIGNUP_FIELDS.email.label}
          helperText={fieldHelp(errors.email, SIGNUP_FIELDS.email.help)}
          error={errors.email !== undefined}
          autoComplete="email"
          slotProps={{ htmlInput: { maxLength: EMAIL_MAX_LENGTH } }}
          required
        />
        <PasswordField
          {...register('password', NEW_PASSWORD_RULES)}
          label={SIGNUP_FIELDS.password.label}
          helperText={fieldHelp(errors.password, SIGNUP_FIELDS.password.help)}
          error={errors.password !== undefined}
          autoComplete="new-password"
          required
        />
        <Button type="submit" variant="contained" size="large" loading={isPending}>
          Sign up
        </Button>
      </Stack>
      <GithubSignIn label="Sign up with GitHub" />
    </AuthLayout>
  );
}
