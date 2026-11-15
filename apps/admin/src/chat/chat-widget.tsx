import { CHAT_FORM_FIELDS, isResource, type ChatStatus, type Resource } from '@ers/shared';
import ChatIcon from '@mui/icons-material/Chat';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import Fab from '@mui/material/Fab';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCustom, useResourceParams } from '@refinedev/core';
import { useEffect, useRef, useState } from 'react';

import { ChatComposer } from './chat-composer';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';
import { blocker, reachabilityOf, starterQuestions, type ChatAvailability } from './chat-state';
import { useChat } from './use-chat';
import { useFocusedField } from './use-focused-field';

/** Above the tables' pagination row, which sits at the bottom right of most pages. */
const CORNER = { position: 'fixed', right: 24, bottom: 72 } as const;
const PANEL_SIZE = { width: 380, height: 520 } as const;

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

interface ChatPanelProps {
  chat: ReturnType<typeof useChat>;
  availability: ChatAvailability;
  screen: { name: Resource; label: string } | undefined;
  field: { name: string; label: string } | undefined;
  onClose: () => void;
}

/** The open panel: header, conversation (or why it cannot start) and the question box. */
function ChatPanel({
  chat,
  availability,
  screen,
  field,
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
  const context =
    screen === undefined ? undefined : [screen.label, field?.label].filter(Boolean).join(' · ');
  return (
    <Paper
      elevation={8}
      role="dialog"
      aria-label="Help chat"
      sx={{
        ...CORNER,
        ...PANEL_SIZE,
        maxWidth: 'calc(100vw - 48px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ChatHeader
        reachability={reachabilityOf(availability, chat.connection)}
        context={context}
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
 * The help chat: a button in the corner opens a panel that answers questions about the screen
 * that is open, and about the field the user was last in. Nothing connects until it is first
 * opened; the conversation, and an answer still streaming, survive closing the panel.
 */
export function ChatWidget(): React.JSX.Element {
  const [isOpen, setOpen] = useState(false);
  const [wasOpened, setWasOpened] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
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
  // Back to the button after closing, so keyboard users are not dropped at the top of the page.
  useEffect(() => {
    if (!isOpen && wasOpened) fabRef.current?.focus();
  }, [isOpen, wasOpened]);
  if (!isOpen) {
    return (
      <Fab
        ref={fabRef}
        color="primary"
        aria-label="Open help chat"
        onClick={() => {
          setOpen(true);
          setWasOpened(true);
          // A failed status check is retried on reopening, as the panel tells the user.
          if (query.isError) void query.refetch();
        }}
        sx={CORNER}
      >
        <ChatIcon />
      </Fab>
    );
  }
  return (
    <ChatPanel
      chat={chat}
      availability={availability}
      screen={screen}
      field={field}
      onClose={() => {
        setOpen(false);
      }}
    />
  );
}
