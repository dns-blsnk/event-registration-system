import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import { parseAnswer, type AnswerBlock, type InlinePart } from '../model/answer-format';

const CODE_SX = {
  fontFamily: 'monospace',
  fontSize: '0.85em',
  px: 0.5,
  borderRadius: 0.5,
  bgcolor: 'action.hover',
} as const;

/** Lists indent their markers inside the bubble rather than past its edge. */
const LIST_SX = { m: 0, pl: 2.5 } as const;

function Inline({ parts }: { parts: readonly InlinePart[] }): React.JSX.Element {
  return (
    <>
      {parts.map((part, index) => {
        const key = `${String(index)}:${part.kind}`;
        switch (part.kind) {
          case 'strong':
            return (
              <Box key={key} component="strong" sx={{ fontWeight: 'fontWeightBold' }}>
                {part.text}
              </Box>
            );
          case 'code':
            return (
              <Box key={key} component="code" sx={CODE_SX}>
                {part.text}
              </Box>
            );
          case 'text':
            return <span key={key}>{part.text}</span>;
        }
      })}
    </>
  );
}

function Block({ block }: { block: AnswerBlock }): React.JSX.Element {
  switch (block.kind) {
    case 'heading':
      return (
        // A real heading for screen readers, in the size of the answer's text.
        <Typography component="h3" variant="body2" fontWeight="fontWeightBold">
          <Inline parts={block.parts} />
        </Typography>
      );
    case 'paragraph':
      return (
        <Typography variant="body2">
          {block.lines.map((line, index) => (
            <span key={String(index)}>
              {index > 0 && <br />}
              <Inline parts={line} />
            </span>
          ))}
        </Typography>
      );
    case 'list':
      return (
        <Box
          component={block.isOrdered ? 'ol' : 'ul'}
          sx={LIST_SX}
          {...(block.isOrdered ? { start: block.start } : {})}
        >
          {block.items.map((item, index) => (
            <Typography key={String(index)} component="li" variant="body2">
              <Inline parts={item} />
            </Typography>
          ))}
        </Box>
      );
    case 'code':
      return (
        <Box component="pre" sx={{ ...CODE_SX, m: 0, p: 1, overflowX: 'auto', whiteSpace: 'pre' }}>
          <code>{block.text}</code>
        </Box>
      );
  }
}

/**
 * An assistant's answer with its simple formatting: paragraphs, lists, bold and code. Parsed again
 * only when its text changes, not for every streamed piece of another answer.
 */
export function AnswerText({
  text,
  isFailed = false,
}: {
  text: string;
  /** A cut-off answer keeps its formatting, in the error colour, with the error after it. */
  isFailed?: boolean;
}): React.JSX.Element {
  const blocks = useMemo(() => parseAnswer(text), [text]);
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}
      color={isFailed ? 'error.main' : 'inherit'}
    >
      {blocks.map((block, index) => (
        <Block key={`${String(index)}:${block.kind}`} block={block} />
      ))}
    </Box>
  );
}
