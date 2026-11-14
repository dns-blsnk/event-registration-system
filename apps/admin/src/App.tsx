import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Refine } from '@refinedev/core';
import { RefineThemes, RefineSnackbarProvider, useNotificationProvider } from '@refinedev/mui';
import routerProvider from '@refinedev/react-router';
import { BrowserRouter, Route, Routes } from 'react-router';

/** Root of the admin: theme, notifications, router and Refine. Resources and providers come next. */
export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <ThemeProvider theme={RefineThemes.Blue}>
        <CssBaseline />
        <GlobalStyles styles={{ html: { WebkitFontSmoothing: 'auto' } }} />
        <RefineSnackbarProvider>
          <Refine routerProvider={routerProvider} notificationProvider={useNotificationProvider}>
            <Routes>
              <Route
                index
                element={<Typography variant="h4">Event Registration Admin</Typography>}
              />
            </Routes>
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
