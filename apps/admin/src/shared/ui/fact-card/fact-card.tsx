import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { TINT } from '@/shared/theme';

/** Keeps the detail line's room when a card has no detail, so every card in a row lines up. */
const EMPTY_LINE = ' ';

/**
 * One fact about a record (when, where, who, how full) for detail pages. Every card has the same
 * shape: the label, the main value on one line, a detail line under it, and optional extra content
 * (such as a bar) at the bottom, so a row of cards reads as one set.
 */
export function FactCard({
  icon,
  label,
  value,
  detail,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: '1 1 220px', minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={(theme) => ({
            display: 'flex',
            p: 1,
            borderRadius: 2,
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, TINT.faint),
          })}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          {/* The full text stays reachable on hover when a long name is cut short. */}
          <Typography variant="subtitle1" fontWeight={600} noWrap title={value}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap title={detail}>
            {detail ?? EMPTY_LINE}
          </Typography>
          {children !== undefined && <Box sx={{ mt: 1 }}>{children}</Box>}
        </Box>
      </Stack>
    </Paper>
  );
}
