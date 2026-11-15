import Box from '@mui/material/Box';

/**
 * Text that always takes the width of its widest version, so a changing number never moves what
 * is next to it. A hidden copy of the widest version sits in the same grid cell and sets the width
 * in whatever font the browser renders; digits are made equal width so any count of that length fits.
 */
export function StableWidthText({
  text,
  widest,
}: {
  text: string;
  widest: string;
}): React.JSX.Element {
  return (
    <Box component="span" sx={{ display: 'inline-grid', fontVariantNumeric: 'tabular-nums' }}>
      <Box component="span" sx={{ gridArea: '1 / 1' }}>
        {text}
      </Box>
      <Box component="span" aria-hidden sx={{ gridArea: '1 / 1', visibility: 'hidden' }}>
        {widest}
      </Box>
    </Box>
  );
}
