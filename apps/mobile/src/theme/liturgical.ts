import type { ThemeColor } from '@/theme/colors';

// Liturgical color swatches and rank ordering, shared by the santoral and
// celebrations screens. These are fixed by the rite (independent of the app's
// theme accent) — a Mass in Lent is violet whatever accent the user picked.

// Representative hex for each liturgical color code romcal emits.
export const LITURGICAL_COLORS: Record<string, string> = {
  WHITE: '#e7dcbf',
  RED: '#b3392a',
  GREEN: '#4f7a3a',
  PURPLE: '#6a3b7a',
  ROSE: '#d488a4',
  BLACK: '#2b2b2b',
};

// Returns the loose ThemeColor type so it drops straight into Tamagui `bg`.
export function liturgicalColor(code: string | undefined): ThemeColor {
  return (code && LITURGICAL_COLORS[code]) || LITURGICAL_COLORS.GREEN;
}

// Precedence, highest first — used to sort a day's celebrations and to pick
// the ones worth showing on the celebrations timeline.
const RANK_ORDER: Record<string, number> = {
  SOLEMNITY: 0,
  FEAST: 1,
  MEMORIAL: 2,
  OPTIONAL_MEMORIAL: 3,
  SUNDAY: 4,
  WEEKDAY: 5,
};

export function rankOrder(rank: string): number {
  return RANK_ORDER[rank] ?? 99;
}
