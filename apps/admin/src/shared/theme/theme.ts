import { alpha, createTheme } from '@mui/material/styles';

import { BRAND, FEEDBACK, NEUTRAL, RADIUS, SX_RADIUS_UNIT, TINT } from './tokens';

/** The admin's MUI theme: logo colours, a white header and calm, flat surfaces. */
export const theme = createTheme({
  palette: {
    primary: { main: BRAND.blue, dark: BRAND.navy, light: BRAND.sky, contrastText: NEUTRAL.white },
    secondary: {
      main: BRAND.teal,
      dark: BRAND.tealDark,
      light: BRAND.cyan,
      contrastText: NEUTRAL.white,
    },
    success: { main: FEEDBACK.success, contrastText: NEUTRAL.white },
    warning: { main: FEEDBACK.warning, contrastText: NEUTRAL.white },
    error: { main: FEEDBACK.error, contrastText: NEUTRAL.white },
    info: { main: FEEDBACK.info, contrastText: NEUTRAL.white },
    text: { primary: NEUTRAL.ink, secondary: NEUTRAL.slate },
    divider: NEUTRAL.line,
    background: { default: NEUTRAL.canvas, paper: NEUTRAL.white },
  },
  // The scale numeric `borderRadius` values in sx multiply; kept at Refine's 6 so they keep their
  // shapes. Cards and inputs get the larger brand radius explicitly below.
  shape: { borderRadius: SX_RADIUS_UNIT },
  typography: {
    // The platform's own UI font: nothing to download, and the same face the OS uses.
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  components: {
    // The header sits on white, where the logo's blues read; a hairline separates it.
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: { backgroundColor: NEUTRAL.white, borderBottom: `1px solid ${NEUTRAL.line}` },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: `${String(RADIUS)}px` } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: `${String(RADIUS)}px` } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: `1px solid ${NEUTRAL.line}` } },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: alpha(BRAND.blue, TINT.faint),
          },
        },
      },
    },
  },
});
