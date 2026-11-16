import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AnswerText } from './answer-text';
import { AssistantAvatar } from './assistant-avatar';

import type { ListToOpen } from '../model/list-to-open';
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

/**
 * What the bubble shows: an answer the assistant wrote, formatted (a cut-off one too); plain text
 * for questions and for an error alone; "Thinking…" before anything arrives; or nothing while the
 * progress line already says what the assistant is doing.
 */
function bubbleContent(
  message: ChatMessage,
): { kind: 'answer' | 'plain'; text: string } | undefined {
  if (message.text !== '') {
    const isAnswer = message.role === 'assistant' && message.state !== 'failed';
    return { kind: isAnswer || hasPartialAnswer(message) ? 'answer' : 'plain', text: message.text };
  }
  if (message.state !== 'streaming' || message.progress !== undefined) return undefined;
  return { kind: 'plain', text: 'Thinking…' };
}

/** A failed answer that had text before the error (the error follows a blank line). */
function hasPartialAnswer(message: ChatMessage): boolean {
  return (
    message.role === 'assistant' && message.state === 'failed' && message.text.includes('\n\n')
  );
}

/** What the assistant is doing while it answers, under the text it has written so far. */
function ProgressLine({ text }: { text: string }): React.JSX.Element {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {text}
    </Typography>
  );
}

/** How the chat names an opened list and opens it again; absent where lists cannot be opened. */
export interface ListLinks {
  describe: (list: ListToOpen) => string;
  open: (list: ListToOpen) => void;
}

/**
 * The list the assistant opened for an answer, as a link back to that result; or, when unsaved
 * changes held it back, a link to open it.
 */
function OpenedList({
  list,
  links,
}: {
  list: NonNullable<ChatMessage['list']>;
  links: ListLinks;
}): React.JSX.Element {
  return (
    <Link
      component="button"
      type="button"
      variant="caption"
      sx={{ display: 'block', textAlign: 'left', mt: 0.5 }}
      onClick={() => {
        links.open(list.target);
      }}
    >
      {`${list.isOpened ? 'Opened' : 'Open'} ${links.describe(list.target)}`}
    </Link>
  );
}

function BubbleText({ message }: { message: ChatMessage }): React.JSX.Element | null {
  const content = bubbleContent(message);
  const isFailed = message.state === 'failed';
  if (content === undefined) return null;
  if (content.kind === 'answer') return <AnswerText text={content.text} isFailed={isFailed} />;
  return (
    <Typography
      variant="body2"
      sx={{ whiteSpace: 'pre-wrap' }}
      color={isFailed ? 'error' : 'inherit'}
    >
      {content.text}
    </Typography>
  );
}

function Bubble({
  message,
  links,
}: {
  message: ChatMessage;
  links: ListLinks | undefined;
}): React.JSX.Element {
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
        <BubbleText message={message} />
        {message.progress !== undefined && <ProgressLine text={message.progress} />}
        {message.list !== undefined && links !== undefined && (
          <OpenedList list={message.list} links={links} />
        )}
        {message.state === 'cancelled' && (
          <Typography variant="caption" color="text.secondary">
            Stopped.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

/** A long suggestion wraps inside its chip instead of running past the panel. */
const SUGGESTION_SX = {
  height: 'auto',
  maxWidth: '100%',
  '& .MuiChip-label': { whiteSpace: 'normal', py: 0.75 },
} as const;

/** Before the first question: what the assistant does, and questions to start with. */
function Welcome({
  suggestions,
  onAsk,
}: {
  suggestions: readonly string[];
  onAsk: ((question: string) => void) | undefined;
}): React.JSX.Element {
  return (
    // Never wider than the panel: the flex parent would otherwise let it grow to its longest line.
    <Stack spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0, width: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <AssistantAvatar />
        <Typography variant="body2">
          Ask in any language. I can explain how things work, find the events, sessions and bookings
          you can see, and open the list for you.
        </Typography>
      </Stack>
      {onAsk !== undefined &&
        suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            label={suggestion}
            variant="outlined"
            color="primary"
            sx={SUGGESTION_SX}
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
  links,
}: {
  messages: readonly ChatMessage[];
  suggestions: readonly string[];
  links?: ListLinks;
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
          <Bubble key={`${message.role}:${message.id}`} message={message} links={links} />
        ))
      )}
    </Stack>
  );
}
