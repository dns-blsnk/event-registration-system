import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Avatar from '@mui/material/Avatar';

const SIZES = { small: 28, large: 40 } as const;

/** The assistant's mark, wherever it speaks: beside answers, and on the chat header (inverted). */
export function AssistantAvatar({
  size = 'small',
  isInverted = false,
}: {
  size?: keyof typeof SIZES;
  /** White with a blue icon, for the gradient header. */
  isInverted?: boolean;
}): React.JSX.Element {
  return (
    <Avatar
      sx={{
        width: SIZES[size],
        height: SIZES[size],
        bgcolor: isInverted ? 'common.white' : 'primary.main',
        color: isInverted ? 'primary.main' : 'common.white',
      }}
    >
      <AutoAwesomeIcon fontSize={size === 'small' ? 'small' : 'medium'} />
    </Avatar>
  );
}
