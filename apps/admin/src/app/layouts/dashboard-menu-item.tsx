import DashboardIcon from '@mui/icons-material/Dashboard';
import { useMenu } from '@refinedev/core';
import { useThemedLayoutContext } from '@refinedev/mui';
import { Link } from 'react-router';

import { HOME_PATH } from '@/shared/config';
import { SiderMenuEntry } from '@/shared/ui/sider-menu-entry';

/**
 * The side menu's link to the dashboard, first in the menu. Every role has a dashboard, so unlike
 * Refine's own entry it asks no access check (the matrix has no "dashboard" resource).
 */
export function DashboardMenuItem({ isCollapsed }: { isCollapsed: boolean }): React.JSX.Element {
  // The same rule Refine uses to highlight its entries, so only one entry is ever marked.
  const { selectedKey } = useMenu();
  const { setMobileSiderOpen } = useThemedLayoutContext();
  const isCurrent = selectedKey === HOME_PATH;
  return (
    <SiderMenuEntry
      component={Link}
      to={HOME_PATH}
      label="Dashboard"
      icon={<DashboardIcon />}
      isCollapsed={isCollapsed}
      isSelected={isCurrent}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => {
        setMobileSiderOpen(false);
      }}
    />
  );
}
