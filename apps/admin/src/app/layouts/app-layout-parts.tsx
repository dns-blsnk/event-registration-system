import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { HamburgerMenu, ThemedSider } from '@refinedev/mui';

import { ChatMenuItem } from '@/features/help-chat';

import { UserMenu } from './user-menu';

import type { RefineThemedLayoutHeaderProps, RefineThemedLayoutSiderProps } from '@refinedev/mui';

/** The header: the menu toggle on small screens, then the signed-in user on the right. */
export function AppHeader({ sticky = true }: RefineThemedLayoutHeaderProps): React.JSX.Element {
  return (
    <AppBar position={sticky ? 'sticky' : 'relative'}>
      <Toolbar>
        <HamburgerMenu />
        <Box sx={{ flexGrow: 1 }} />
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}

/** The side menu's own title bar and the space above its first entry. */
const SIDER_TOP = { title: 64, padding: 16 } as const;

/**
 * Refine's side menu without its Logout entry (signing out lives in the user menu), with the help
 * chat's entry kept at the bottom, apart from the screens.
 */
export function AppSider(props: RefineThemedLayoutSiderProps): React.JSX.Element {
  return (
    <ThemedSider
      {...props}
      render={({ items, collapsed }) => (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: `calc(100dvh - ${String(SIDER_TOP.title + SIDER_TOP.padding)}px)`,
          }}
        >
          {/* One block: the entries themselves must not stretch to fill the column. */}
          <Box>{items}</Box>
          <Box sx={{ mt: 'auto', pb: 1 }}>
            <ChatMenuItem isCollapsed={collapsed} />
          </Box>
        </Box>
      )}
    />
  );
}
