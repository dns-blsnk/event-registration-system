/**
 * The ERS design tokens, taken from the logo: its blues (E and R) and the teal-to-mint of the S.
 * Components never use raw colours; they take these through the MUI theme. Text colours on them
 * keep at least WCAG AA contrast (4.5:1) with white.
 */
export const BRAND = {
  /** The E: deepest blue. */
  navy: '#0A3496',
  /** The R: the main brand blue. */
  blue: '#144EB8',
  sky: '#3595DF',
  /** The S, from teal to mint: accents and soft backgrounds only (too light for text). */
  cyan: '#26BBE0',
  mint: '#69FAD9',
  /** The S darkened until text on it reads. */
  teal: '#0A7C8F',
  tealDark: '#075E6D',
} as const;

export const NEUTRAL = {
  ink: '#0F1B2D',
  slate: '#5B6B82',
  line: '#E3E8F0',
  canvas: '#F4F7FB',
  white: '#FFFFFF',
} as const;

export const FEEDBACK = {
  success: '#0E7C6B',
  warning: '#B45309',
  error: '#B42318',
  info: '#2570D4',
} as const;

/** Corner radius of cards and inputs, in px. */
export const RADIUS = 10;

/** The unit numeric sx `borderRadius` values are multiplied by (Refine's default). */
export const SX_RADIUS_UNIT = 6;

/** Opacity of a colour tinting a background: status chips, the selected menu item. */
export const TINT = { soft: 0.12, faint: 0.08 } as const;
