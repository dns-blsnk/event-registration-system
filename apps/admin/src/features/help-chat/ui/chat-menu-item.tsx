import ChatIcon from '@mui/icons-material/Chat';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { useThemedLayoutContext } from '@refinedev/mui';

import { CHAT_TRIGGER_ATTRIBUTE, useHelpChat } from '../model/help-chat-context';

const LABEL = 'Help';
/** Refine's own menu entries, so this one lines up with them (spacing in theme units). */
const ENTRY = {
  paddingLeft: 2,
  paddingY: 1,
  iconGap: 1.5,
  iconMinWidth: 24,
  fontSize: 14,
} as const;

/**
 * The side menu's entry to the help chat, at the bottom of the menu, styled like the other
 * entries. Collapsed, it shows only the icon with the label as a tooltip.
 */
export function ChatMenuItem({ isCollapsed }: { isCollapsed: boolean }): React.JSX.Element {
  const { isOpen, toggle } = useHelpChat();
  const { setMobileSiderOpen } = useThemedLayoutContext();
  return (
    // An empty title shows no tooltip: expanded, the label is already there.
    <Tooltip title={isCollapsed ? LABEL : ''} placement="right" arrow>
      <ListItemButton
        {...{ [CHAT_TRIGGER_ATTRIBUTE]: true }}
        selected={isOpen}
        aria-expanded={isOpen}
        aria-label="Help chat"
        onClick={() => {
          // On a phone the menu is a drawer over the page; it gives way to the chat.
          setMobileSiderOpen(false);
          toggle();
        }}
        sx={{ pl: ENTRY.paddingLeft, py: ENTRY.paddingY, justifyContent: 'center' }}
      >
        <ListItemIcon
          sx={{
            justifyContent: 'center',
            minWidth: ENTRY.iconMinWidth,
            mr: isCollapsed ? 0 : ENTRY.iconGap,
            color: 'currentColor',
          }}
        >
          <ChatIcon />
        </ListItemIcon>
        <ListItemText
          primary={LABEL}
          slotProps={{ primary: { noWrap: true, fontSize: ENTRY.fontSize } }}
        />
      </ListItemButton>
    </Tooltip>
  );
}
