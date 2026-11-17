import DashboardIcon from '@mui/icons-material/Dashboard';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { useThemedLayoutContext } from '@refinedev/mui';
import { Link, useLocation } from 'react-router';

import { HOME_PATH } from '@/shared/config';

const LABEL = 'Dashboard';
/** Refine's own menu entries, so this one lines up with them (spacing in theme units). */
const ENTRY = {
  paddingLeft: 2,
  paddingY: 1,
  iconGap: 1.5,
  iconMinWidth: 24,
  fontSize: 14,
} as const;

/**
 * The side menu's link to the dashboard, first in the menu. Every role has a dashboard, so unlike
 * Refine's own entry it asks no access check (the matrix has no "dashboard" resource).
 */
export function DashboardMenuItem({ isCollapsed }: { isCollapsed: boolean }): React.JSX.Element {
  const { pathname } = useLocation();
  const { setMobileSiderOpen } = useThemedLayoutContext();
  const isCurrent = pathname === HOME_PATH;
  return (
    // An empty title shows no tooltip: expanded, the label is already there.
    <Tooltip title={isCollapsed ? LABEL : ''} placement="right" arrow>
      <ListItemButton
        component={Link}
        to={HOME_PATH}
        selected={isCurrent}
        aria-current={isCurrent ? 'page' : undefined}
        onClick={() => {
          setMobileSiderOpen(false);
        }}
        sx={{
          pl: ENTRY.paddingLeft,
          py: ENTRY.paddingY,
          justifyContent: 'center',
          color: isCurrent ? 'primary.main' : 'text.primary',
        }}
      >
        <ListItemIcon
          sx={{
            justifyContent: 'center',
            minWidth: ENTRY.iconMinWidth,
            mr: isCollapsed ? 0 : ENTRY.iconGap,
            color: 'currentColor',
          }}
        >
          <DashboardIcon />
        </ListItemIcon>
        <ListItemText
          primary={LABEL}
          slotProps={{ primary: { noWrap: true, fontSize: ENTRY.fontSize } }}
        />
      </ListItemButton>
    </Tooltip>
  );
}
