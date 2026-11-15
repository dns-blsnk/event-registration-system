import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router';

/** Shown when the signed-in role may not open a page. */
export function ForbiddenPage(): React.JSX.Element {
  return (
    <Stack spacing={2} alignItems="center" sx={{ mt: 8 }}>
      <Typography variant="h4" component="h1">
        No access
      </Typography>
      <Typography>Your role does not allow this page.</Typography>
      <Button component={Link} to="/" variant="contained">
        Back to start
      </Button>
    </Stack>
  );
}
