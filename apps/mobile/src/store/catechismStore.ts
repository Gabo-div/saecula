import { create } from 'zustand';

// A transient deep-link target for the Catechism reader: set from a chat
// citation tap, consumed once by CatechismScreen to open the paragraph's
// section and focus it. Not persisted.
interface CatechismState {
  focusParagraph: number | null;
  focus: (n: number) => void;
  clearFocus: () => void;
}

export const useCatechismStore = create<CatechismState>((set) => ({
  focusParagraph: null,
  focus: (n) => set({ focusParagraph: n }),
  clearFocus: () => set({ focusParagraph: null }),
}));
