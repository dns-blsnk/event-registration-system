import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Authenticated, Refine } from '@refinedev/core';
import {
  ErrorComponent,
  RefineSnackbarProvider,
  RefineThemes,
  ThemedLayout,
  useNotificationProvider,
} from '@refinedev/mui';
import routerProvider, { CatchAllNavigate, NavigateToResource } from '@refinedev/react-router';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router';

import { LoginPage } from './pages/auth/login-page';
import { ForbiddenPage } from './pages/errors/forbidden-page';
import { accessControlProvider } from './providers/access-control-provider';
import { authProvider, HOME_PATH, LOGIN_PATH } from './providers/auth-provider';
import { dataProvider } from './providers/data-provider';

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
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
