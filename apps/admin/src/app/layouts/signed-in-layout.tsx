import { ThemedLayout } from '@refinedev/mui';
import { UnsavedChangesNotifier } from '@refinedev/react-router';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';

import { ChatWidget, HelpChatProvider, useAssistantPageKey } from '@/features/help-chat';
import { ErrorBoundary } from '@/shared/ui/error-boundary';

import { AppHeader, AppSider } from './app-layout-parts';
import { AppTitle } from './app-title';

/** A page that crashes shows the error screen inside the layout; any navigation clears it. */
function PageErrorBoundary(): React.JSX.Element {
  const { key } = useLocation();
  // A list the assistant opened is mounted anew, so it reads the filters it was opened with.
  const pageKey = useAssistantPageKey();
  return (
    <ErrorBoundary resetKey={key}>
      {/* Each page is its own chunk, loaded on first visit. */}
      <Suspense key={pageKey} fallback={null}>
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
    <HelpChatProvider>
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
    </HelpChatProvider>
  );
}
