import { CHAT_QUESTION_MAX_LENGTH } from '@ers/shared';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { CHAT_INPUT_ATTRIBUTE } from './use-focused-field';

interface ChatComposerProps {
  /** The label of the field the question is about, shown as the placeholder. */
  fieldLabel: string | undefined;
  canAsk: boolean;
  isAnswering: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}

/** The question box: Send while idle, Stop while an answer is streaming. */
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
    <Stack component="form" direction="row" spacing={1} sx={{ p: 1 }} onSubmit={send}>
      <TextField
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        placeholder={
          fieldLabel === undefined ? 'Ask about this screen' : `Ask about “${fieldLabel}”`
        }
        size="small"
        fullWidth
        inputRef={inputRef}
        disabled={!canAsk}
        slotProps={{
          htmlInput: {
            maxLength: CHAT_QUESTION_MAX_LENGTH,
            'aria-label': 'Your question',
            [CHAT_INPUT_ATTRIBUTE]: '',
          },
        }}
      />
      {isAnswering ? (
        <Button onClick={onStop}>Stop</Button>
      ) : (
        <Button type="submit" variant="contained" disabled={question === '' || !canAsk}>
          Send
        </Button>
      )}
    </Stack>
  );
}
