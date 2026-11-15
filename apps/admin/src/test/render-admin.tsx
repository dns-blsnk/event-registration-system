import { ThemeProvider } from '@mui/material/styles';
import { Refine } from '@refinedev/core';
import { RefineSnackbarProvider } from '@refinedev/mui';
import routerProvider from '@refinedev/react-router';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useAppNotificationProvider } from '@/app/config/notification-provider';
import { resources } from '@/app/config/resources';
import { accessControlProvider, authProvider } from '@/entities/viewer';
import { dataProvider } from '@/shared/api';
import { theme } from '@/shared/theme';

/** Renders one admin page at a path with the real providers (HTTP is mocked with mockHttp). */
export function renderAdminPage({
  path,
  route,
  element,
}: {
  path: string;
  route: string;
  element: React.JSX.Element;
}): RenderResult {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider theme={theme}>
        <RefineSnackbarProvider>
          <Refine
            routerProvider={routerProvider}
            authProvider={authProvider}
            dataProvider={dataProvider}
            accessControlProvider={accessControlProvider}
            notificationProvider={useAppNotificationProvider}
            resources={resources}
            // No retries in tests: a failed request should show its error state right away.
            options={{
              disableTelemetry: true,
              reactQuery: { clientConfig: { defaultOptions: { queries: { retry: false } } } },
            }}
          >
            <Routes>
              <Route path={route} element={element} />
            </Routes>
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}
