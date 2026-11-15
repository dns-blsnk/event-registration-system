import Box from '@mui/material/Box';

/** Below this the table stops shrinking and the page scrolls instead, so it never shows two rows. */
const MIN_FILL_HEIGHT = 400;

const FILL_COLUMN = { display: 'flex', flexDirection: 'column', flexGrow: 1 } as const;

/**
 * Props for a list page's Refine `List`: its card and card body stretch down to the bottom of the
 * window (the layout makes the page card at least that tall), so a PageFill inside takes the rest.
 */
export const FILL_LIST_PROPS = {
  wrapperProps: { sx: FILL_COLUMN },
  contentProps: { sx: FILL_COLUMN },
};

/** Holds a list page's table: it ends where the window ends, and its rows scroll inside it. */
export function PageFill({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Box sx={{ flex: '1 1 0', minHeight: MIN_FILL_HEIGHT }}>{children}</Box>;
}
