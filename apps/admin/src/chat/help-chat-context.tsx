import { createContext, useContext, useMemo, useState } from 'react';

/** Marks the menu entries that open the chat; Refine renders the menu twice (desktop and phone). */
export const CHAT_TRIGGER_ATTRIBUTE = 'data-help-chat-trigger';

/**
 * Keyboard focus back to the entry that opened the chat, the copy that is on screen. On a phone the
 * menu is closed by then, so no entry is visible and focus is left where it is.
 */
function focusVisibleTrigger(): void {
  const entries = document.querySelectorAll<HTMLElement>(`[${CHAT_TRIGGER_ATTRIBUTE}]`);
  [...entries].find((entry) => entry.offsetParent !== null)?.focus();
}

interface HelpChatControls {
  isOpen: boolean;
  /** How many times the chat was opened; the panel retries a failed status check on each. */
  openCount: number;
  toggle: () => void;
  close: () => void;
  /** Puts keyboard focus back on the menu entry after the chat is closed. */
  focusTrigger: () => void;
}

const HelpChatContext = createContext<HelpChatControls | undefined>(undefined);

/** Whether the help chat is open, shared by its menu entry and its panel. */
export function HelpChatProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isOpen, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const controls = useMemo<HelpChatControls>(
    () => ({
      isOpen,
      openCount,
      toggle: () => {
        if (!isOpen) setOpenCount((count) => count + 1);
        setOpen(!isOpen);
      },
      close: () => {
        setOpen(false);
      },
      focusTrigger: focusVisibleTrigger,
    }),
    [isOpen, openCount],
  );
  return <HelpChatContext.Provider value={controls}>{children}</HelpChatContext.Provider>;
}

export function useHelpChat(): HelpChatControls {
  const controls = useContext(HelpChatContext);
  if (controls === undefined) throw new Error('useHelpChat is used outside HelpChatProvider');
  return controls;
}
