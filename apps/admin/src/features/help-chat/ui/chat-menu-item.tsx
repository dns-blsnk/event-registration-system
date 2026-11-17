import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useThemedLayoutContext } from '@refinedev/mui';

import { SiderMenuEntry } from '@/shared/ui/sider-menu-entry';

import { CHAT_TRIGGER_ATTRIBUTE, useHelpChat } from '../model/help-chat-context';

const LABEL = 'AI assistant';

/** The side menu's entry to the help chat, at the bottom of the menu, styled like the other entries. */
export function ChatMenuItem({ isCollapsed }: { isCollapsed: boolean }): React.JSX.Element {
  const { isOpen, toggle } = useHelpChat();
  const { setMobileSiderOpen } = useThemedLayoutContext();
  return (
    <SiderMenuEntry
      {...{ [CHAT_TRIGGER_ATTRIBUTE]: true }}
      label={LABEL}
      icon={<AutoAwesomeIcon />}
      isCollapsed={isCollapsed}
      isSelected={isOpen}
      aria-expanded={isOpen}
      aria-label={LABEL}
      onClick={() => {
        // On a phone the menu is a drawer over the page; it gives way to the chat.
        setMobileSiderOpen(false);
        toggle();
      }}
    />
  );
}
