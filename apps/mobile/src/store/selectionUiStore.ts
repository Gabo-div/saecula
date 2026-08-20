import { create } from 'zustand';

// A selectable item (a Bible verse or a Catechism paragraph). It carries
// everything the sheet needs so the sheet stays content-agnostic.
export interface SelectionItem {
  entityId: string; // bookmark key: "JHN.3.16", "CCC.123"
  reference: string; // per-item label: "John 3:16", "CCC 123"
  text: string;
  number: number; // builds the collapsed header range (3–5, 7)
}

export interface SelectionContext {
  // Prepended to the collapsed number range in the header, e.g. "John 3:" / "CCC ".
  headerPrefix: string;
  // Bible-only context for the (verse-image) share card; null hides Share.
  share: { bookName: string; chapter: number } | null;
}

// Selection lives here (not in a screen) so the sheet can be mounted above the
// tab navigator and render over the bottom tab bar.
interface SelectionState extends SelectionContext {
  items: SelectionItem[];
  // True while the full-screen Share page is focused, so the global sheet hides
  // (it renders above the navigator and would otherwise cover the page).
  sharing: boolean;
  toggle: (item: SelectionItem, ctx: SelectionContext) => void;
  clear: () => void;
  setSharing: (sharing: boolean) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  items: [],
  headerPrefix: '',
  share: null,
  sharing: false,
  toggle: (item, ctx) =>
    set((s) => {
      const exists = s.items.some((i) => i.entityId === item.entityId);
      return {
        items: exists
          ? s.items.filter((i) => i.entityId !== item.entityId)
          : [...s.items, item],
        headerPrefix: ctx.headerPrefix,
        share: ctx.share,
      };
    }),
  clear: () => set({ items: [] }),
  setSharing: (sharing) => set({ sharing }),
}));

// Compact header/reference label: "3–5, 7" collapsed and prefixed, e.g.
// "John 3:3–5, 7" or "Catecismo 123, 125".
export function selectionRangeLabel(items: SelectionItem[], headerPrefix: string): string {
  const s = items.map((i) => i.number).sort((a, b) => a - b);
  if (s.length === 0) return '';
  const parts: string[] = [];
  let start = s[0];
  let prev = s[0];
  for (let i = 1; i <= s.length; i++) {
    if (i < s.length && s[i] === prev + 1) {
      prev = s[i];
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    if (i < s.length) {
      start = s[i];
      prev = s[i];
    }
  }
  return `${headerPrefix}${parts.join(', ')}`;
}
