import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/** A read-only value with a small label above it, for detail pages. */
export function LabelledValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div">{children}</Typography>
    </Box>
  );
}
