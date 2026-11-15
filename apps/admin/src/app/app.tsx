import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import { CanAccess, Refine } from '@refinedev/core';
import { ErrorComponent, RefineSnackbarProvider } from '@refinedev/mui';
import routerProvider, { CatchAllNavigate, DocumentTitleHandler } from '@refinedev/react-router';
import { Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';

import { accessControlProvider, authProvider, hasSignedOutByChoice } from '@/entities/viewer';
import { LoginPage } from '@/pages/login';
import { SignupPage } from '@/pages/signup';
import { dataProvider } from '@/shared/api';
import { documentTitle, HOME_PATH, LOGIN_PATH, REGISTER_PATH } from '@/shared/config';
import { theme } from '@/shared/theme';
import { ErrorBoundary } from '@/shared/ui/error-boundary';

import { useAppNotificationProvider } from './config/notification-provider';
import { queryClient } from './config/query-client';
import { resources } from './config/resources';
import { forgetPersonalStateOnSignOut } from './model/session-cleanup';
import { AuthGate } from './routes/auth-gate';
import {
  AppLogList,
  AppLogShow,
  CatalogList,
  CatalogShow,
  CustomerList,
  DashboardPage,
  EventCreate,
  EventEdit,
  EventList,
  EventShow,
  ForbiddenPage,
  MyRegistrationList,
  RegistrationList,
  SessionList,
  SessionShow,
  SignedInLayout,
  TagList,
  UserList,
} from './routes/signed-in-pages';

forgetPersonalStateOnSignOut(queryClient);

/**
 * Where a visitor without a session goes. An expired session keeps the address to return to
 * after signing in again; a sign-out by choice does not (see hasSignedOutByChoice).
 */
function ToSignIn(): React.JSX.Element {
  return hasSignedOutByChoice() ? (
    <Navigate to={LOGIN_PATH} replace />
  ) : (
    <CatchAllNavigate to={LOGIN_PATH} />
  );
}

/** Root of the admin: theme, notifications, router, auth and access control, then the routes. */
export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ html: { WebkitFontSmoothing: 'auto' } }} />
        <RefineSnackbarProvider>
          <Refine
            routerProvider={routerProvider}
            authProvider={authProvider}
            dataProvider={dataProvider}
            accessControlProvider={accessControlProvider}
            notificationProvider={useAppNotificationProvider}
            resources={resources}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              reactQuery: { clientConfig: queryClient },
            }}
          >
            {/* Last resort for crashes outside a page: the layout, menu or the sign-in pages. */}
            <ErrorBoundary>
              <Routes>
                <Route
                  element={
                    <AuthGate fallback={<ToSignIn />}>
                      <Suspense fallback={null}>
                        <SignedInLayout />
                      </Suspense>
                    </AuthGate>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  {/* Resource pages: the shared matrix decides; pages outside a resource need only a session. */}
                  <Route
                    element={
                      <CanAccess fallback={<ForbiddenPage />}>
                        <Outlet />
                      </CanAccess>
                    }
                  >
                    <Route path="/events" element={<EventList />} />
                    <Route path="/events/create" element={<EventCreate />} />
                    <Route path="/events/:id" element={<EventShow />} />
                    <Route path="/events/:id/edit" element={<EventEdit />} />
                    <Route path="/sessions" element={<SessionList />} />
                    <Route path="/sessions/:id" element={<SessionShow />} />
                    <Route path="/registrations" element={<RegistrationList />} />
                    <Route path="/customers" element={<CustomerList />} />
                    <Route path="/tags" element={<TagList />} />
                    <Route path="/users" element={<UserList />} />
                    <Route path="/catalog" element={<CatalogList />} />
                    <Route path="/catalog/:id" element={<CatalogShow />} />
                    <Route path="/my-registrations" element={<MyRegistrationList />} />
                    <Route path="/logs" element={<AppLogList />} />
                    <Route path="/logs/:id" element={<AppLogShow />} />
                  </Route>
                  <Route path="/forbidden" element={<ForbiddenPage />} />
                  <Route path="*" element={<ErrorComponent />} />
                </Route>
                <Route
                  element={
                    <AuthGate fallback={<Outlet />} keepsFallbackWhileChecking>
                      {/* Signed in already: every role starts on its dashboard. */}
                      <Navigate to={HOME_PATH} replace />
                    </AuthGate>
                  }
                >
                  <Route path={LOGIN_PATH} element={<LoginPage />} />
                  <Route path={REGISTER_PATH} element={<SignupPage />} />
                </Route>
              </Routes>
            </ErrorBoundary>
            <DocumentTitleHandler
              handler={({ autoGeneratedTitle }) => documentTitle(autoGeneratedTitle)}
            />
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
