/**
 * Design tokens — reference values for consistent sizing across the design system.
 * Actual styling uses CSS variables (theme.css) + Tailwind utility classes.
 */

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
} as const;

export const fontSize = {
  xs: '11px',
  sm: '12px',
  base: '13px',
  lg: '14px',
  xl: '16px',
} as const;

export const radius = {
  sm: '3px',
  md: '6px',
  lg: '8px',
  full: '9999px',
} as const;

export const transition = {
  fast: '100ms ease',
  normal: '150ms ease',
} as const;
