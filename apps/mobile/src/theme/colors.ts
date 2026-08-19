import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Theme system: two modes (dark parchment-on-umber, light on-parchment) ×
// five liturgical accent colors. Components never import fixed colors —
// they call useAppTheme() (src/store/themeStore.ts), which builds an
// AppTheme from the persisted mode + accent.
// ---------------------------------------------------------------------------

export type ThemeMode = 'dark' | 'amoled' | 'light';
export type AccentKey = 'gold' | 'crimson' | 'marian' | 'olive' | 'violet';

interface AccentShades {
  base: string; // main accent (icons, highlights, active states)
  dim: string; // subdued accent (secondary borders)
  deep: string; // deep tone for filled cards ("Today's word")
}

// Liturgical palette: gold, red of the martyrs, Marian blue, ordinary-time
// green, Advent/Lent violet. Light mode uses darker bases for contrast on
// parchment.
export const ACCENTS: Record<AccentKey, { dark: AccentShades; light: AccentShades }> = {
  gold: {
    dark: { base: '#d9b04c', dim: '#93793a', deep: '#571e30' },
    light: { base: '#9a7413', dim: '#c2a75e', deep: '#571e30' },
  },
  crimson: {
    dark: { base: '#d05b4a', dim: '#8f4034', deep: '#5c1a14' },
    light: { base: '#a02e1f', dim: '#c98d84', deep: '#5c1a14' },
  },
  marian: {
    dark: { base: '#6f94c9', dim: '#4c6489', deep: '#1e3252' },
    light: { base: '#2e5288', dim: '#8ba3c4', deep: '#1e3252' },
  },
  olive: {
    dark: { base: '#94ab5e', dim: '#657643', deep: '#2e3c14' },
    light: { base: '#4f6420', dim: '#9aa878', deep: '#2e3c14' },
  },
  violet: {
    dark: { base: '#a984c9', dim: '#755b8c', deep: '#3a2352' },
    light: { base: '#63417f', dim: '#a48fb8', deep: '#3a2352' },
  },
};

export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

// Tamagui color props are typed against theme tokens; raw hex/rgba values
// need a loose type to pass through (same trick as `serif` below).
export type ThemeColor = any;

export interface AppTheme {
  mode: ThemeMode;
  bg: ThemeColor;
  bgElevated: ThemeColor;
  border: ThemeColor;
  strong: ThemeColor; // headings / emphasized text
  text: ThemeColor; // body text
  muted: ThemeColor; // secondary text
  accent: ThemeColor;
  accentDim: ThemeColor;
  card: ThemeColor; // filled accent card background
  onCard: ThemeColor; // text on `card`
  chip: ThemeColor; // translucent pill/button background over images
  error: ThemeColor;
  // Home hero gradient: scrim over the artwork fading into `bg`.
  overlay: [string, string, string];
}

// Every accent tints the whole surface palette: the neutrals (background,
// borders, text) are generated from the accent's hue, so gold gives the
// warm umber look and Marian blue gives a cold night-blue one.
const ACCENT_HUES: Record<AccentKey, number> = {
  gold: 43,
  crimson: 8,
  marian: 215,
  olive: 78,
  violet: 272,
};

const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;

// Minimal HSL→RGB (s/l in %) for building rgba() overlay stops.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function buildTheme(mode: ThemeMode, accentKey: AccentKey): AppTheme {
  const hue = ACCENT_HUES[accentKey];
  const accent = ACCENTS[accentKey][mode === 'light' ? 'light' : 'dark'];

  // AMOLED: pure black surfaces (pixels off), accent-tinted everything else.
  if (mode === 'amoled') {
    return {
      mode,
      bg: '#000000',
      bgElevated: hsl(hue, 25, 6),
      border: hsl(hue, 20, 12),
      strong: hsl(hue, 35, 88),
      text: hsl(hue, 28, 84),
      muted: hsl(hue, 14, 52),
      chip: 'rgba(0,0,0,0.55)',
      error: '#e5484d',
      accent: accent.base,
      accentDim: accent.dim,
      card: accent.deep,
      onCard: hsl(hue, 35, 90),
      overlay: ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.92)', 'rgba(0,0,0,1)'],
    };
  }

  if (mode === 'dark') {
    const [r, g, b] = hslToRgb(hue, 29, 5);
    return {
      mode,
      bg: hsl(hue, 29, 5),
      bgElevated: hsl(hue, 27, 9),
      border: hsl(hue, 24, 16),
      strong: hsl(hue, 35, 88),
      text: hsl(hue, 28, 84),
      muted: hsl(hue, 14, 56),
      chip: 'rgba(0,0,0,0.45)',
      error: '#e5484d',
      accent: accent.base,
      accentDim: accent.dim,
      card: accent.deep,
      onCard: hsl(hue, 35, 90),
      overlay: [`rgba(${r},${g},${b},0.35)`, `rgba(${r},${g},${b},0.95)`, `rgba(${r},${g},${b},1)`],
    };
  }

  const [r, g, b] = hslToRgb(hue, 50, 95);
  const [er, eg, eb] = hslToRgb(hue, 60, 98);
  return {
    mode,
    bg: hsl(hue, 50, 95),
    bgElevated: hsl(hue, 60, 98),
    border: hsl(hue, 28, 82),
    strong: hsl(hue, 35, 10),
    text: hsl(hue, 20, 20),
    muted: hsl(hue, 14, 41),
    chip: `rgba(${er},${eg},${eb},0.78)`,
    error: '#c53035',
    accent: accent.base,
    accentDim: accent.dim,
    card: accent.deep,
    onCard: hsl(hue, 35, 90),
    overlay: [`rgba(${r},${g},${b},0.15)`, `rgba(${r},${g},${b},0.9)`, `rgba(${r},${g},${b},1)`],
  };
}

// System serif keeps the sacral look without bundling fonts. Tamagui's
// fontFamily prop is typed against configured font tokens, so the raw
// platform font name needs a loose type to pass through.
export const serif: any = Platform.select({ ios: 'Georgia', default: 'serif' });
