import { ROLE_LABELS, type PublicUser } from '@ers/shared';
import LogoutIcon from '@mui/icons-material/Logout';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useGetIdentity, useLogout, useWarnAboutChange } from '@refinedev/core';
import { useState } from 'react';

const MAX_INITIALS = 2;
/** Shown when a name gives no letters at all. */
const NO_INITIALS = '?';
const UNSAVED_CHANGES = 'You have unsaved changes. Sign out anyway?';

/** "Ada Lovelace" -> "AL"; the first characters (whole, emoji included) of up to two words. */
export function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, MAX_INITIALS)
    .map((word) => (Array.from(word)[0] ?? '').toUpperCase())
    .join('');
  return initials === '' ? NO_INITIALS : initials;
}

/** Signs out, first asking if a form has unsaved changes (as Refine's own Logout did). */
function useSafeLogout(): () => void {
  const { mutate: logout } = useLogout();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();
  return () => {
    if (warnWhen && !window.confirm(UNSAVED_CHANGES)) return;
    setWarnWhen(false);
    logout();
  };
}

/**
 * The signed-in user in the header: who and in which role (useful when trying the roles), and
 * sign-out, which used to sit at the bottom of the side menu.
 */
export function UserMenu(): React.JSX.Element | null {
  // null right after sign-out or before the identity reloads after sign-in.
  const { data: user, isLoading } = useGetIdentity<PublicUser | null>();
  const signOut = useSafeLogout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (user === undefined || user === null) {
    // Without the user (it failed to load) there is still a way out.
    return isLoading ? null : (
      <IconButton color="inherit" aria-label="Logout" onClick={signOut}>
        <LogoutIcon />
      </IconButton>
    );
  }
  const close = (): void => {
    setAnchor(null);
  };
  return (
    <>
      <Button
        color="inherit"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={`Account menu for ${user.name}`}
        onClick={(event) => {
          setAnchor(event.currentTarget);
        }}
        sx={{ textAlign: 'left', py: 0.5 }}
        startIcon={
          <Avatar
            sx={{ width: 36, height: 36, fontSize: 15, fontWeight: 600, bgcolor: 'primary.main' }}
          >
            {initialsOf(user.name)}
          </Avatar>
        }
      >
        {/* Name and role: which role is in use matters when trying the roles out. */}
        <Box component="span" sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.25 }}>
          <Typography component="span" display="block" fontWeight={600} fontSize={15}>
            {user.name}
          </Typography>
          <Typography component="span" display="block" variant="caption" color="text.secondary">
            {ROLE_LABELS[user.role]}
          </Typography>
        </Box>
      </Button>
      <Popover
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {/* Who is signed in sits outside the menu, so focus opens on the first action. */}
        <Box sx={{ px: 2, py: 1.5, minWidth: 240 }}>
          <Typography fontWeight={700}>{user.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {user.email}
          </Typography>
          <Chip size="small" label={ROLE_LABELS[user.role]} sx={{ mt: 1 }} />
        </Box>
        <Divider />
        <MenuList autoFocusItem aria-label="Account">
          <MenuItem
            onClick={() => {
              close();
              signOut();
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}
