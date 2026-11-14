import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ChatMessage } from './use-chat';

/** Read by screen readers, not shown: the standard visually-hidden pattern. */
const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

/**
 * The conversation, newest at the bottom. Screen readers hear each answer once, when it is
 * finished, rather than every streamed piece.
 */
export function ChatMessages({
  messages,
}: {
  messages: readonly ChatMessage[];
}): React.JSX.Element {
  const lastFinished = messages.findLast(
    (message) => message.role === 'assistant' && message.state !== 'streaming',
  );
  return (
    <Stack spacing={1} sx={{ overflowY: 'auto', flex: 1, p: 1 }}>
      <Box component="span" aria-live="polite" sx={VISUALLY_HIDDEN}>
        {lastFinished?.text}
      </Box>
      {messages.map((message) => (
        <Box
          key={`${message.role}:${message.id}`}
          sx={{
            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            px: 1.5,
            py: 1,
            borderRadius: 2,
            bgcolor: message.role === 'user' ? 'primary.main' : 'action.hover',
            color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
          }}
        >
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap' }}
            color={message.state === 'failed' ? 'error' : 'inherit'}
          >
            {message.text === '' && message.state === 'streaming' ? 'Thinking…' : message.text}
          </Typography>
          {message.state === 'cancelled' && (
            <Typography variant="caption" color="text.secondary">
              Stopped.
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}
