import { CHAT_FORM_FIELDS, isResource, type ChatStatus, type Resource } from '@ers/shared';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCustom, useResourceParams } from '@refinedev/core';
import { useEffect, useRef, useState } from 'react';

import { ChatComposer } from './chat-composer';
import { ChatMessages } from './chat-messages';
import { useChat, type ChatConnection } from './use-chat';
import { useFocusedField } from './use-focused-field';

/** Above the tables' pagination row, which sits at the bottom right of most pages. */
const CORNER = { position: 'fixed', right: 24, bottom: 72 } as const;

const CONNECTION_NOTE: Readonly<Record<ChatConnection, string | undefined>> = {
  connecting: 'Connecting…',
  online: undefined,
  offline: 'No connection to the assistant. Retrying…',
};

interface ChatAvailability {
  isLoaded: boolean;
  isFailed: boolean;
  isAvailable: boolean;
}

/** What, if anything, keeps the user from asking right now; undefined when they can ask. */
function blocker(
  { isLoaded, isFailed, isAvailable }: ChatAvailability,
  hasScreen: boolean,
): string | undefined {
  if (isFailed) return 'Could not reach the assistant. Close the chat and open it again to retry.';
  if (!isLoaded) return undefined;
  if (!isAvailable) return 'The assistant is not available right now.';
  return hasScreen ? undefined : 'Open a screen to ask about its fields.';
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
  screen: Resource | undefined;
  field: { name: string; label: string } | undefined;
  onClose: () => void;
}

/** The open panel: conversation, connection state and the question box. */
function ChatPanel({
  chat,
  availability,
  screen,
  field,
  onClose,
}: ChatPanelProps): React.JSX.Element {
  const reason = blocker(availability, screen !== undefined);
  const note = availability.isAvailable ? CONNECTION_NOTE[chat.connection] : undefined;
  return (
    <Paper
      elevation={8}
      role="dialog"
      aria-label="Help chat"
      sx={{
        ...CORNER,
        width: 360,
        maxWidth: 'calc(100vw - 48px)',
        height: 480,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1 }}
      >
        <Typography variant="subtitle1" component="h2">
          Help
        </Typography>
        <IconButton aria-label="Close help chat" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      {reason !== undefined && <Alert severity="info">{reason}</Alert>}
      {note !== undefined && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
          {note}
        </Typography>
      )}
      <ChatMessages messages={chat.messages} />
      <ChatComposer
        fieldLabel={field?.label}
        canAsk={availability.isAvailable && screen !== undefined}
        isAnswering={chat.isAnswering}
        onAsk={(question) => {
          if (screen !== undefined)
            chat.ask({
              resource: screen,
              ...(field === undefined ? {} : { field: field.name }),
              question,
            });
        }}
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
  const screen = isResource(resource?.name) ? resource.name : undefined;
  const field = screenField(screen, focusedName);
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
