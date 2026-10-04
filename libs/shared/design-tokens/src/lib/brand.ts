/**
 * Identidad visual Vitalia en TypeScript (para gráficos, canvas, meta theme-color, etc.).
 * Debe mantenerse en sincronía con `src/styles/_tokens.scss`.
 * Guía completa: docs/06-identidad-visual.md
 */
export const BRAND = {
  name: 'Vitalia',
  descriptor: 'Ecosistema Digital Hospitalario',
  gradient: 'linear-gradient(135deg, #0D9488, #0284C7)',
} as const;

export const COLORS = {
  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryDeep: '#0F766E',
  secondary: '#0284C7',
  secondaryLight: '#38BDF8',
  secondaryDeep: '#0369A1',
  success: '#10B981',
  successDeep: '#059669',
  live: '#34D399',
  warning: '#F59E0B',
  warningDeep: '#D97706',
  danger: '#F43F5E',
  dangerDeep: '#BE123C',
  indigo: '#6366F1',
  cyan: '#06B6D4',
} as const;

export const NEUTRALS = {
  light: {
    bg: '#F8FAFC',
    bg2: '#F1F5F9',
    paper: '#FFFFFF',
    ink: '#0F172A',
    muted: '#475569',
    muted2: '#64748B',
  },
  dark: {
    bg: '#06111D',
    bg2: '#0B1A2C',
    paper: '#0B1A2C',
    ink: '#F1F5FB',
    muted: '#94A3B8',
    muted2: '#64748B',
  },
} as const;

/** Color asociado a cada nivel de triaje de `@vitalia/contracts`. */
export const TRIAGE_COLORS = {
  STABLE: COLORS.success,
  ATTENTION: COLORS.warning,
  CRITICAL: COLORS.danger,
} as const;

export const FONT_FAMILY = "'Plus Jakarta Sans', system-ui, sans-serif";

/** Clave de localStorage para el modo claro/oscuro (compartida con el portal). */
export const THEME_STORAGE_KEY = 'vitalia_theme';
