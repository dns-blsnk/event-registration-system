import { ALMOST_FULL_RATIO, toPercent } from '@ers/shared';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';

/** From this share of seats taken a session is getting busy (amber); full-ish from ALMOST_FULL_RATIO (red). */
export const BUSY_RATIO = 0.7;

export type FillLevel = 'success' | 'warning' | 'error';

/**
 * Green while there is room, amber when busy, red once "almost full" (the filter's threshold).
 * Judged on the whole percentage the label shows, so a bar reading "90%" is never amber.
 */
export function fillLevel(rate: number): FillLevel {
  const percent = toPercent(rate);
  if (percent >= toPercent(ALMOST_FULL_RATIO)) return 'error';
  return percent >= toPercent(BUSY_RATIO) ? 'warning' : 'success';
}

/**
 * How full something is, as a coloured bar with its label (a percentage, or seats left), so the
 * busy and almost-full rows stand out in a long list without reading every number.
 */
export function FillBar({
  rate,
  label,
  name,
  showsLabel = true,
}: {
  rate: number;
  label: string;
  /** What is measured, e.g. "Seats left", for screen readers. */
  name: string;
  /** Off where the same number is already shown next to the bar; screen readers still get it. */
  showsLabel?: boolean;
}): React.JSX.Element {
  const value = toPercent(Math.min(Math.max(rate, 0), 1));
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', height: '100%' }}>
      <LinearProgress
        variant="determinate"
        value={value}
        color={fillLevel(rate)}
        aria-label={name}
        aria-valuetext={label}
        sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
      />
      {/* The bar already announces it (aria-valuetext); read once, not twice. */}
      {showsLabel && (
        <Typography variant="body2" aria-hidden sx={{ minWidth: 56, textAlign: 'right' }}>
          {label}
        </Typography>
      )}
    </Box>
  );
}
