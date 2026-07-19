import { Platform } from 'react-native';

// Fixed liturgical dark palette — the app always renders in dark mode,
// gold-on-umber like illuminated manuscripts.
export const colors = {
  bg: '#12100a',
  bgElevated: '#1c1810',
  bgOverlay: 'rgba(18, 16, 10, 0.55)',
  border: '#2e2818',
  gold: '#d9b04c',
  goldDim: '#93793a',
  cream: '#f1e7d0',
  text: '#e8dfc8',
  textMuted: '#a3987d',
  burgundy: '#571e30',
  burgundyLight: '#6d2740',
  error: '#e5484d',
} as const;

// System serif keeps the sacral look without bundling fonts. Tamagui's
// fontFamily prop is typed against configured font tokens, so the raw
// platform font name needs a loose type to pass through.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const serif: any = Platform.select({ ios: 'Georgia', default: 'serif' });
