import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';

import { APP_NAME, LOGO_URL } from '@/shared/config';

const LOGO_SIZE = 36;

/**
 * The logo at the top of the side menu, linking home. One link only: Refine's default title
 * nests its router link inside an MUI link, which renders <a> inside <a>. An <img> rather than
 * inline SVG, so the logo's gradient ids cannot clash with other SVGs on the page.
 */
export function AppTitle({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  return (
    <Link
      component={RouterLink}
      to="/"
      underline="none"
      aria-label={`${APP_NAME} home`}
      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
    >
      {/* Decorative: the link's label already names the product. */}
      <Box component="img" src={LOGO_URL} alt="" width={LOGO_SIZE} height={LOGO_SIZE} />
      {!collapsed && (
        <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {APP_NAME}
        </Typography>
      )}
    </Link>
  );
}
