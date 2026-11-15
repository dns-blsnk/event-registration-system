import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';

import { TINT } from '../theme/tokens';

import type { StatusColor } from '../theme/status-colors';

/**
 * A status label in its colour: a tinted background with dark text (readable, calm in long
 * lists); `emphasis` fills it solid for the one that matters, such as the viewer's own booking.
 */
export function StatusChip({
  label,
  color,
  emphasis = false,
}: {
  label: string;
  color: StatusColor;
  emphasis?: boolean;
}): React.JSX.Element {
  // Grey stays the plain filled chip used everywhere else; emphasis only matters for colours.
  if (color === 'default') return <Chip size="small" label={label} />;
  if (emphasis) return <Chip size="small" label={label} color={color} />;
  return (
    <Chip
      size="small"
      label={label}
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette[color].main, TINT.soft),
        color: theme.palette[color].dark,
      })}
    />
  );
}
