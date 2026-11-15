import { CHAT_FORM_FIELDS, isResource, type ChatStatus, type Resource } from '@ers/shared';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCustom, useResourceParams } from '@refinedev/core';
import { useThemedLayoutContext } from '@refinedev/mui';
import { useEffect, useRef } from 'react';

import {
  blocker,
  reachabilityOf,
  starterQuestions,
  type ChatAvailability,
} from '../model/chat-state';
import { useHelpChat } from '../model/help-chat-context';
import { useChat } from '../model/use-chat';
import { useFocusedField } from '../model/use-focused-field';

import { ChatComposer } from './chat-composer';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';

import type { SxProps, Theme } from '@mui/material/styles';

const PANEL_SIZE = { width: 380, height: 520 } as const;
/** Refine's side menu widths, open and collapsed. */
const SIDER_WIDTH = { open: 240, collapsed: 56 } as const;
/** The gap between the panel and the menu and the bottom of the window. */
const PANEL_GAP = 16;

/** Next to the side menu's bottom, where its entry is; across the bottom on a phone. */
function panelPlace(isSiderCollapsed: boolean) {
  const siderWidth = isSiderCollapsed ? SIDER_WIDTH.collapsed : SIDER_WIDTH.open;
  return {
    position: 'fixed',
    // Over the page, as the floating button was: tables' sticky parts must not cover the composer.
    zIndex: 'speedDial',
    bottom: PANEL_GAP,
    left: { xs: PANEL_GAP, md: siderWidth + PANEL_GAP },
    maxWidth: `calc(100vw - ${String(PANEL_GAP)}px - ${String(PANEL_GAP)}px)`,
  } as const satisfies SxProps<Theme>;
}

/** The screen's name as the menu shows it (the resource label), else its route name. */
function labelOf(resource: { name: string; meta?: { label?: string } }): string {
  return resource.meta?.label ?? resource.name;
}

/** The focused field of this screen, only if the screen's form has it (anything else is not sent). */
function screenField(
  screen: Resource | undefined,
  name: string | undefined,
): { name: string; label: string } | undefined {
  if (screen === undefined || name === undefined) return undefined;
  const description = CHAT_FORM_FIELDS[screen][name];
  return description === undefined ? undefined : { name, label: description.label };
}

/** What questions are about, e.g. "Sessions · Capacity"; nothing outside a resource screen. */
function contextOf(
  screen: { label: string } | undefined,
  field: { label: string } | undefined,
): string | undefined {
  return screen === undefined
    ? undefined
    : [screen.label, field?.label].filter(Boolean).join(' · ');
}

interface ChatPanelProps {
  chat: ReturnType<typeof useChat>;
  availability: ChatAvailability;
  screen: { name: Resource; label: string } | undefined;
  field: { name: string; label: string } | undefined;
  isSiderCollapsed: boolean;
  onClose: () => void;
}

/** The open panel: header, conversation (or why it cannot start) and the question box. */
function ChatPanel({
  chat,
  availability,
  screen,
  field,
  isSiderCollapsed,
  onClose,
}: ChatPanelProps): React.JSX.Element {
  const reason = blocker(availability, screen !== undefined);
  // One rule for both ways to ask (typing and the starter questions): only while connected.
  const canAsk = availability.isAvailable && screen !== undefined && chat.connection === 'online';
  const ask = (question: string): void => {
    if (screen === undefined) return;
    chat.ask({
      resource: screen.name,
      ...(field === undefined ? {} : { field: field.name }),
      question,
    });
  };
  const context = contextOf(screen, field);
  return (
    <Paper
      elevation={8}
      role="dialog"
      aria-label="Help chat"
      sx={{
        ...panelPlace(isSiderCollapsed),
        ...PANEL_SIZE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ChatHeader
        reachability={reachabilityOf(availability, chat.connection)}
        context={context}
        onNewChat={chat.messages.length === 0 ? undefined : chat.reset}
        onClose={onClose}
      />
      {reason === undefined ? (
        <ChatMessages
          messages={chat.messages}
          suggestions={starterQuestions(field?.label)}
          onAsk={canAsk && !chat.isAnswering ? ask : undefined}
        />
      ) : (
        <Stack
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{ flex: 1, p: 3, textAlign: 'center', bgcolor: 'background.default' }}
        >
          <CloudOffIcon color="disabled" fontSize="large" />
          <Typography variant="body2" color="text.secondary">
            {reason}
          </Typography>
        </Stack>
      )}
      <ChatComposer
        fieldLabel={field?.label}
        canAsk={canAsk}
        isAnswering={chat.isAnswering}
        onAsk={ask}
        onStop={chat.cancel}
      />
    </Paper>
  );
}

/**
 * The help chat's panel, opened from its entry in the side menu. It answers questions about the
 * screen that is open, and about the field the user was last in. Nothing connects until it is first
 * opened; the conversation, and an answer still streaming, survive closing the panel.
 */
export function ChatWidget(): React.JSX.Element | null {
  const { isOpen, openCount, close, focusTrigger } = useHelpChat();
  const { siderCollapsed } = useThemedLayoutContext();
  const wasOpened = openCount > 0;
  // Tracked while closed too: the user picks a field first, then opens the chat to ask about it.
  const focusedName = useFocusedField();
  const { resource } = useResourceParams();
  const screen = isResource(resource?.name)
    ? { name: resource.name, label: labelOf(resource) }
    : undefined;
  const field = screenField(screen?.name, focusedName);
  const { query } = useCustom<ChatStatus>({
    url: '/chat/status',
    method: 'get',
    queryOptions: { enabled: wasOpened },
    errorNotification: false,
  });
  const availability: ChatAvailability = {
    isLoaded: query.isSuccess,
    isFailed: query.isError,
    isAvailable: query.data?.data.isAvailable === true,
  };
  const chat = useChat(availability.isAvailable && wasOpened);
  // A failed status check is retried on reopening, as the panel tells the user.
  const retriedFor = useRef(openCount);
  useEffect(() => {
    if (openCount === retriedFor.current) return;
    retriedFor.current = openCount;
    if (query.isError) void query.refetch();
  }, [openCount, query]);
  // Back to the menu entry after closing, so keyboard users are not dropped at the top of the page.
  useEffect(() => {
    if (!isOpen && wasOpened) focusTrigger();
  }, [isOpen, wasOpened, focusTrigger]);
  if (!isOpen) return null;
  return (
    <ChatPanel
      chat={chat}
      availability={availability}
      screen={screen}
      field={field}
      isSiderCollapsed={siderCollapsed}
      onClose={close}
    />
  );
}
