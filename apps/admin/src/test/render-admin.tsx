import { ThemeProvider } from '@mui/material/styles';
import { Refine } from '@refinedev/core';
import { RefineThemes } from '@refinedev/mui';
import routerProvider from '@refinedev/react-router';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { accessControlProvider } from '../providers/access-control-provider';
import { authProvider } from '../providers/auth-provider';
import { dataProvider } from '../providers/data-provider';
import { resources } from '../resources';

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
      <ThemeProvider theme={RefineThemes.Blue}>
        <Refine
          routerProvider={routerProvider}
          authProvider={authProvider}
          dataProvider={dataProvider}
          accessControlProvider={accessControlProvider}
          resources={resources}
          options={{ disableTelemetry: true }}
        >
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </Refine>
      </ThemeProvider>
    </MemoryRouter>,
  );
}
