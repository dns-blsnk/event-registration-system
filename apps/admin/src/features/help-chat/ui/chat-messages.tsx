import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AssistantAvatar } from './assistant-avatar';

import type { ChatMessage } from '../model/use-chat';

/** Read by screen readers, not shown: the standard visually-hidden pattern. */
const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

/** Bubbles stop short of the panel's edge, so who said what stays clear. */
const BUBBLE_MAX_WIDTH = '88%';
/** The speech-bubble "tail": the corner nearest the speaker is nearly square (px). */
const TAIL_RADIUS = '4px';

const USER_BUBBLE = {
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  borderBottomRightRadius: TAIL_RADIUS,
} as const;

const ASSISTANT_BUBBLE = {
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: 1,
  borderColor: 'divider',
  borderBottomLeftRadius: TAIL_RADIUS,
} as const;

function bubbleText(message: ChatMessage): string {
  return message.text === '' && message.state === 'streaming' ? 'Thinking…' : message.text;
}

function Bubble({ message }: { message: ChatMessage }): React.JSX.Element {
  const isUser = message.role === 'user';
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-end"
      sx={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: BUBBLE_MAX_WIDTH }}
    >
      {!isUser && <AssistantAvatar />}
      <Box sx={{ px: 1.5, py: 1, borderRadius: 3, ...(isUser ? USER_BUBBLE : ASSISTANT_BUBBLE) }}>
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap' }}
          color={message.state === 'failed' ? 'error' : 'inherit'}
        >
          {bubbleText(message)}
        </Typography>
        {message.state === 'cancelled' && (
          <Typography variant="caption" color="text.secondary">
            Stopped.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

/** Before the first question: what the assistant does, and questions to start with. */
function Welcome({
  suggestions,
  onAsk,
}: {
  suggestions: readonly string[];
  onAsk: ((question: string) => void) | undefined;
}): React.JSX.Element {
  return (
    <Stack spacing={1.5} alignItems="flex-start">
      <Stack direction="row" spacing={1} alignItems="center">
        <AssistantAvatar />
        <Typography variant="body2">
          Ask what a field means or how to fill it in. I answer from this screen’s own field
          descriptions.
        </Typography>
      </Stack>
      {onAsk !== undefined &&
        suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            label={suggestion}
            variant="outlined"
            color="primary"
            onClick={() => {
              onAsk(suggestion);
            }}
          />
        ))}
    </Stack>
  );
}

/**
 * The conversation, newest at the bottom, or a welcome with starter questions while it is empty.
 * Screen readers hear each answer once, when it is finished, rather than every streamed piece.
 */
export function ChatMessages({
  messages,
  suggestions,
  onAsk,
}: {
  messages: readonly ChatMessage[];
  suggestions: readonly string[];
  /** Undefined while the user cannot ask (offline, unavailable): the suggestions are hidden. */
  onAsk: ((question: string) => void) | undefined;
}): React.JSX.Element {
  const lastFinished = messages.findLast(
    (message) => message.role === 'assistant' && message.state !== 'streaming',
  );
  return (
    <Stack spacing={1.5} sx={{ overflowY: 'auto', flex: 1, p: 1.5, bgcolor: 'background.default' }}>
      <Box component="span" aria-live="polite" sx={VISUALLY_HIDDEN}>
        {lastFinished?.text}
      </Box>
      {messages.length === 0 ? (
        // Fills the space and centres the welcome (the Stack's spacing overrides child margins).
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Welcome suggestions={suggestions} onAsk={onAsk} />
        </Box>
      ) : (
        messages.map((message) => (
          <Bubble key={`${message.role}:${message.id}`} message={message} />
        ))
      )}
    </Stack>
  );
}
