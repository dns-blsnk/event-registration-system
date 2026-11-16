import { CHAT_QUESTION_MAX_LENGTH } from '@ers/shared';
import SendIcon from '@mui/icons-material/Send';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { CHAT_INPUT_ATTRIBUTE } from '../model/use-focused-field';

interface ChatComposerProps {
  /** The label of the field the question is about, shown as the placeholder. */
  fieldLabel: string | undefined;
  canAsk: boolean;
  isAnswering: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}

/** The question box: a send button while idle, a stop button while an answer is streaming. */
export function ChatComposer({
  fieldLabel,
  canAsk,
  isAnswering,
  onAsk,
  onStop,
}: ChatComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Focused as soon as it can be used, so keyboard users land where they type.
  useEffect(() => {
    if (canAsk) inputRef.current?.focus();
  }, [canAsk]);
  const question = draft.trim();
  const send = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (question === '' || !canAsk || isAnswering) return;
    onAsk(question);
    setDraft('');
  };
  return (
    <Stack
      component="form"
      direction="row"
      spacing={1}
      alignItems="center"
      onSubmit={send}
      sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}
    >
      <TextField
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        placeholder={fieldLabel === undefined ? 'Ask in any language' : `Ask about “${fieldLabel}”`}
        size="small"
        fullWidth
        inputRef={inputRef}
        disabled={!canAsk}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 6 } }}
        slotProps={{
          htmlInput: {
            maxLength: CHAT_QUESTION_MAX_LENGTH,
            'aria-label': 'Your question',
            [CHAT_INPUT_ATTRIBUTE]: '',
          },
        }}
      />
      {isAnswering ? (
        <IconButton color="primary" aria-label="Stop" onClick={onStop}>
          <StopCircleIcon />
        </IconButton>
      ) : (
        <IconButton
          type="submit"
          color="primary"
          aria-label="Send"
          disabled={question === '' || !canAsk}
        >
          <SendIcon />
        </IconButton>
      )}
    </Stack>
  );
}
