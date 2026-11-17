import ListItemButton, { type ListItemButtonProps } from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';

/** Refine's own menu entries, so ours line up with them (spacing in theme units). */
const ENTRY = {
  paddingLeft: 2,
  paddingY: 1,
  iconGap: 1.5,
  iconMinWidth: 24,
  fontSize: 14,
} as const;

type SiderMenuEntryProps<C extends React.ElementType> = ListItemButtonProps<
  C,
  {
    component?: C;
    label: string;
    icon: React.ReactNode;
    isCollapsed: boolean;
    isSelected: boolean;
  }
>;

/**
 * A side menu entry of our own that looks like Refine's: icon and label, selected in the primary
 * colour. Collapsed, it shows only the icon with the label as a tooltip.
 */
export function SiderMenuEntry<C extends React.ElementType = 'div'>({
  label,
  icon,
  isCollapsed,
  isSelected,
  ...buttonProps
}: SiderMenuEntryProps<C>): React.JSX.Element {
  return (
    // An empty title shows no tooltip: expanded, the label is already there.
    <Tooltip title={isCollapsed ? label : ''} placement="right" arrow>
      <ListItemButton
        {...buttonProps}
        selected={isSelected}
        sx={{
          pl: ENTRY.paddingLeft,
          py: ENTRY.paddingY,
          justifyContent: 'center',
          color: isSelected ? 'primary.main' : 'text.primary',
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
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={label}
          slotProps={{ primary: { noWrap: true, fontSize: ENTRY.fontSize } }}
        />
      </ListItemButton>
    </Tooltip>
  );
}
