import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Authenticated, CanAccess, Refine } from '@refinedev/core';
import {
  ErrorComponent,
  RefineSnackbarProvider,
  RefineThemes,
  ThemedLayout,
  useNotificationProvider,
} from '@refinedev/mui';
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from '@refinedev/react-router';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router';

import { LoginPage } from './pages/auth/login-page';
import { ForbiddenPage } from './pages/errors/forbidden-page';
import { EventCreate } from './pages/events/event-create';
import { EventEdit } from './pages/events/event-edit';
import { EventList } from './pages/events/event-list';
import { EventShow } from './pages/events/event-show';
import { accessControlProvider } from './providers/access-control-provider';
import { authProvider, HOME_PATH, LOGIN_PATH } from './providers/auth-provider';
import { dataProvider } from './providers/data-provider';
import { resources } from './resources';

function HomePage(): React.JSX.Element {
  return (
    <Typography variant="h4" component="h1">
      Event Registration Admin
    </Typography>
  );
}

/** Root of the admin: theme, notifications, router, auth and access control, then the routes. */
export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <ThemeProvider theme={RefineThemes.Blue}>
        <CssBaseline />
        <GlobalStyles styles={{ html: { WebkitFontSmoothing: 'auto' } }} />
        <RefineSnackbarProvider>
          <Refine
            routerProvider={routerProvider}
            authProvider={authProvider}
            dataProvider={dataProvider}
            accessControlProvider={accessControlProvider}
            notificationProvider={useNotificationProvider}
            resources={resources}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
          >
            <Routes>
              <Route
                element={
                  <Authenticated key="protected" fallback={<CatchAllNavigate to={LOGIN_PATH} />}>
                    <ThemedLayout>
                      <Outlet />
                    </ThemedLayout>
                  </Authenticated>
                }
              >
                <Route index element={<HomePage />} />
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
                </Route>
                <Route path="/forbidden" element={<ForbiddenPage />} />
                <Route path="*" element={<ErrorComponent />} />
              </Route>
              <Route
                element={
                  <Authenticated key="public" fallback={<Outlet />}>
                    <NavigateToResource fallbackTo={HOME_PATH} />
                  </Authenticated>
                }
              >
                <Route path={LOGIN_PATH} element={<LoginPage />} />
              </Route>
            </Routes>
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
