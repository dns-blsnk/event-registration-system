import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Authenticated, CanAccess, Refine } from '@refinedev/core';
import {
  ErrorComponent,
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider,
} from '@refinedev/mui';
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from '@refinedev/react-router';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router';

import { ChatWidget } from './chat/chat-widget';
import { AppTitle } from './components/app-title';
import { documentTitle } from './components/brand';
import { ErrorBoundary } from './components/error-boundary';
import { AppLogList } from './pages/app-logs/app-log-list';
import { AppLogShow } from './pages/app-logs/app-log-show';
import { LoginPage } from './pages/auth/login-page';
import { SignupPage } from './pages/auth/signup-page';
import { CatalogList } from './pages/catalog/catalog-list';
import { CatalogShow } from './pages/catalog/catalog-show';
import { CustomerList } from './pages/customers/customer-list';
import { ForbiddenPage } from './pages/errors/forbidden-page';
import { EventCreate } from './pages/events/event-create';
import { EventEdit } from './pages/events/event-edit';
import { EventList } from './pages/events/event-list';
import { EventShow } from './pages/events/event-show';
import { MyRegistrationList } from './pages/my-registrations/my-registration-list';
import { RegistrationList } from './pages/registrations/registration-list';
import { SessionList } from './pages/sessions/session-list';
import { SessionShow } from './pages/sessions/session-show';
import { TagList } from './pages/tags/tag-list';
import { UserList } from './pages/users/user-list';
import { accessControlProvider } from './providers/access-control-provider';
import { authProvider, HOME_PATH, LOGIN_PATH, REGISTER_PATH } from './providers/auth-provider';
import { dataProvider } from './providers/data-provider';
import { resources } from './resources';
import { theme } from './theme/theme';

function HomePage(): React.JSX.Element {
  return (
    <Typography variant="h4" component="h1">
      Event Registration Admin
    </Typography>
  );
}

/** A page that crashes shows the error screen inside the layout; any navigation clears it. */
function PageErrorBoundary(): React.JSX.Element {
  const { key } = useLocation();
  return (
    <ErrorBoundary resetKey={key}>
      <Outlet />
    </ErrorBoundary>
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
            notificationProvider={useNotificationProvider}
            resources={resources}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
          >
            {/* Last resort for crashes outside a page: the layout, menu or the sign-in pages. */}
            <ErrorBoundary>
              <Routes>
                <Route
                  element={
                    <Authenticated key="protected" fallback={<CatchAllNavigate to={LOGIN_PATH} />}>
                      <ThemedLayout
                        Title={AppTitle}
                        // The page card fills the window, however few rows it shows.
                        containerBoxProps={{ sx: { minHeight: '100dvh' } }}
                        childrenBoxProps={{
                          sx: {
                            display: 'flex',
                            flexDirection: 'column',
                            '& > .MuiPaper-root': { flexGrow: 1 },
                          },
                        }}
                      >
                        <PageErrorBoundary />
                        <ChatWidget />
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
                    <Authenticated key="public" fallback={<Outlet />}>
                      <NavigateToResource fallbackTo={HOME_PATH} />
                    </Authenticated>
                  }
                >
                  <Route path={LOGIN_PATH} element={<LoginPage />} />
                  <Route path={REGISTER_PATH} element={<SignupPage />} />
                </Route>
              </Routes>
            </ErrorBoundary>
            <UnsavedChangesNotifier />
            <DocumentTitleHandler
              handler={({ autoGeneratedTitle }) => documentTitle(autoGeneratedTitle)}
            />
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
