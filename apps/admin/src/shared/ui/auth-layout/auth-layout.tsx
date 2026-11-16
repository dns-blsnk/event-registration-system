import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { APP_FULL_NAME, LOGO_URL } from '@/shared/config';

const LOGO_SIZE = 56;
const CARD_MAX_WIDTH = 420;

/**
 * The frame of the signed-out pages: the logo and product name above a card with the page's
 * heading, its form and a footer line (usually a link to the other auth page).
 */
export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Stack
      component="main"
      spacing={3}
      sx={{ minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', px: 2, py: 4 }}
    >
      <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
        {/* Decorative: the product name is written right below it. */}
        <Box component="img" src={LOGO_URL} alt="" width={LOGO_SIZE} height={LOGO_SIZE} />
        <Typography variant="h6" component="p" sx={{ color: 'text.primary' }}>
          {APP_FULL_NAME}
        </Typography>
      </Stack>
      <Paper
        variant="outlined"
        sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: CARD_MAX_WIDTH }}
      >
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h5" component="h1">
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          </Stack>
          {children}
          <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            {footer}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
