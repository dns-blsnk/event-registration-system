import { useIsAuthenticated } from '@refinedev/core';
import { useSyncExternalStore } from 'react';

import { hasSignedOut, subscribeToSignOut } from '@/entities/viewer';

import { SessionCheckScreen } from './session-check-screen';

/**
 * Shows `children` to a signed-in user and `fallback` otherwise. Unlike Refine's <Authenticated>,
 * a background re-check (window focus, a refreshed session) keeps a signed-in screen in place.
 * Refine's version blanks the whole tree on every re-check, which remounted each page (every
 * request went out twice) and dropped unsaved form input. While not signed in, a re-check is
 * waited for (it may be the one right after sign-in), so nobody is sent away too early.
 * Sign-out is not waited for: it hides the signed-in area at once.
 */
export function AuthGate({
  children,
  fallback,
  keepsFallbackWhileChecking = false,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
  /**
   * For the sign-in pages: a re-check (window focus) keeps the form and what was typed in it.
   * The signed-in area leaves it off and waits instead, since its fallback is a redirect.
   */
  keepsFallbackWhileChecking?: boolean;
}): React.JSX.Element {
  const { isLoading, isFetching, data } = useIsAuthenticated();
  // Sign-out (or a 401) is known here at once, before Refine re-checks the session: the signed-in
  // screen goes immediately, so none of its queries refetch into 401s.
  const signedOut = useSyncExternalStore(subscribeToSignOut, hasSignedOut);
  const isSignedIn = data?.authenticated === true && !signedOut;
  const isWaiting = isLoading || (isFetching && !isSignedIn && !keepsFallbackWhileChecking);
  if (isWaiting) return <SessionCheckScreen />;
  return <>{isSignedIn ? children : fallback}</>;
}
