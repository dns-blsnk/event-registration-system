import { ThemedLayout } from '@refinedev/mui';
import { UnsavedChangesNotifier } from '@refinedev/react-router';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';

import { ChatWidget } from './chat/chat-widget';
import { AppHeader, AppSider } from './components/app-layout-parts';
import { AppTitle } from './components/app-title';
import { ErrorBoundary } from './components/error-boundary';

/** A page that crashes shows the error screen inside the layout; any navigation clears it. */
function PageErrorBoundary(): React.JSX.Element {
  const { key } = useLocation();
  return (
    <ErrorBoundary resetKey={key}>
      {/* Each page is its own chunk, loaded on first visit. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Everything around a signed-in page: menu, header with the user, help chat. Loaded only after
 * sign-in (see App), so the sign-in page ships none of the app's code.
 */
export function SignedInLayout(): React.JSX.Element {
  return (
    <ThemedLayout
      Title={AppTitle}
      Header={AppHeader}
      Sider={AppSider}
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
      {/* Only signed-in forms warn; sign-in and sign-up never ask to stay. */}
      <UnsavedChangesNotifier />
    </ThemedLayout>
  );
}
