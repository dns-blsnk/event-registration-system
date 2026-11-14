import { AuthPage } from '@refinedev/mui';

/** Email and password sign-in, from Refine's MUI auth page. */
export function LoginPage(): React.JSX.Element {
  return (
    <AuthPage
      type="login"
      title="Event Registration"
      rememberMe={false}
      forgotPasswordLink={false}
      registerLink={false}
    />
  );
}
