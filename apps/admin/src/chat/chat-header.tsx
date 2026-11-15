import AddCommentIcon from '@mui/icons-material/AddCommentOutlined';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { BRAND } from '../theme/tokens';

import { AssistantAvatar } from './assistant-avatar';

import type { ChatReachability } from './chat-state';

const STATUS: Readonly<Record<ChatReachability, { text: string; color: string }>> = {
  online: { text: 'Online', color: 'success.light' },
  connecting: { text: 'Connecting…', color: 'warning.light' },
  offline: { text: 'No connection, retrying…', color: 'warning.light' },
  unavailable: { text: 'Not available', color: 'grey.400' },
};

const HEADER_GRADIENT = `linear-gradient(120deg, ${BRAND.navy}, ${BRAND.blue} 55%, ${BRAND.teal})`;
const DOT_SIZE = 8;

/** The chat's title bar: who answers, whether they can, what the question is about, and close. */
export function ChatHeader({
  reachability,
  context,
  onNewChat,
  onClose,
}: {
  reachability: ChatReachability;
  /** The screen and field questions are about, e.g. "Sessions · Capacity". */
  context: string | undefined;
  /** Absent while there is nothing to start over from. */
  onNewChat: (() => void) | undefined;
  onClose: () => void;
}): React.JSX.Element {
  const status = STATUS[reachability];
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{ px: 2, py: 1.5, background: HEADER_GRADIENT, color: 'common.white' }}
    >
      <AssistantAvatar size="large" isInverted />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" component="h2" fontWeight={700}>
          Help assistant
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box
            sx={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%', bgcolor: status.color }}
          />
          <Typography variant="caption" noWrap>
            {status.text}
            {context === undefined ? '' : ` · ${context}`}
          </Typography>
        </Stack>
      </Box>
      {onNewChat !== undefined && (
        <IconButton aria-label="New chat" onClick={onNewChat} sx={{ color: 'common.white' }}>
          <AddCommentIcon />
        </IconButton>
      )}
      <IconButton aria-label="Close help chat" onClick={onClose} sx={{ color: 'common.white' }}>
        <CloseIcon />
      </IconButton>
    </Stack>
  );
}
