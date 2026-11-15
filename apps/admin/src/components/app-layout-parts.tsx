import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { HamburgerMenu, ThemedSider } from '@refinedev/mui';

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

/** Refine's side menu without its Logout entry: signing out lives in the user menu now. */
export function AppSider(props: RefineThemedLayoutSiderProps): React.JSX.Element {
  return <ThemedSider {...props} render={({ items }) => <>{items}</>} />;
}
