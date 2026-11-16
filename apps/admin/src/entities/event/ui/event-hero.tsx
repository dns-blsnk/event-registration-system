import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { BRAND } from '@/shared/theme';

const HERO_MIN_HEIGHT = 220;
/** A long title wraps to at most this many lines before it is cut with an ellipsis. */
const TITLE_MAX_LINES = 3;
/** Darkens the lower part of a banner so the white title on it stays readable. */
const SCRIM = 'linear-gradient(to top, rgba(10, 20, 45, 0.75), rgba(10, 20, 45, 0) 65%)';
/** Without a banner the hero shows the logo's gradient. */
const BRAND_GRADIENT = `linear-gradient(120deg, ${BRAND.navy}, ${BRAND.blue} 45%, ${BRAND.teal})`;

/**
 * The top of an event page: the banner (or the brand gradient) with the title and an optional
 * status on it, so the page opens on the event, not on a grey form.
 */
export function EventHero({
  title,
  bannerUrl,
  status,
  statusLabel,
}: {
  title: string;
  bannerUrl: string | null;
  status?: React.ReactNode;
  /** Names the status for screen readers, e.g. "Status". */
  statusLabel?: string;
}): React.JSX.Element {
  // A banner that fails to load (removed from storage) leaves the gradient, not a broken image.
  const [hasBannerFailed, setBannerFailed] = useState(false);
  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: HERO_MIN_HEIGHT,
        display: 'flex',
        borderRadius: 2,
        overflow: 'hidden',
        background: BRAND_GRADIENT,
      }}
    >
      {bannerUrl !== null && !hasBannerFailed && (
        <Box
          component="img"
          src={bannerUrl}
          // Decorative here: the title is written on it as the page heading.
          alt=""
          onError={() => {
            setBannerFailed(true);
          }}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      <Stack
        direction="row"
        spacing={2}
        alignItems="flex-end"
        justifyContent="space-between"
        sx={{ position: 'relative', flexGrow: 1, p: 3, background: SCRIM }}
      >
        <Typography
          variant="h4"
          component="h2"
          sx={{
            color: 'common.white',
            fontWeight: 700,
            minWidth: 0,
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: TITLE_MAX_LINES,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: { xs: '1.5rem', sm: '2.125rem' },
          }}
        >
          {title}
        </Typography>
        {status !== undefined && (
          <Box
            role="group"
            aria-label={statusLabel}
            sx={{ bgcolor: 'background.paper', borderRadius: 4, p: 0.25, flexShrink: 0 }}
          >
            {status}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
