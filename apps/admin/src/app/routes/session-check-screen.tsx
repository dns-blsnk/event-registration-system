import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

/** After this long the check is most likely waiting for the API to wake up, not a slow network. */
export const SLOW_CHECK_MS = 3000;

/**
 * Shown while the session is being checked. The free API host sleeps when idle and needs up to a
 * minute to wake, and a blank page for that long looks broken, so after a moment it says why.
 */
export function SessionCheckScreen(): React.JSX.Element {
  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSlow(true);
    }, SLOW_CHECK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return (
    <Box
      role="status"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 2,
        textAlign: 'center',
      }}
    >
      <CircularProgress aria-label="Checking your session" />
      {isSlow && (
        <Typography color="text.secondary">
          Waking up the server. The first visit after a pause can take up to a minute.
        </Typography>
      )}
    </Box>
  );
}
