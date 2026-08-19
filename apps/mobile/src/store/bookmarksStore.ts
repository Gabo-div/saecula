import { create } from 'zustand';

import {
  fetchSavedVerses,
  saveVerse,
  setHighlight,
  setNote,
  deleteSavedVerse,
  createBookmarkGroup,
  deleteBookmarkGroup,
} from '@/api/client';
import type { SavedVerse } from '@/types/api';

// A verse can now hold several bookmark rows: at most one standalone
// (group_id null) plus any number of group rows. The reader only needs one
// colour per verse, so we derive:
//   - singleByEntity: the standalone row (for the single-verse context menu)
//   - highlightByEntity: the most-recently-updated highlight for that verse
//     (standalone or group), which is what the reader tints — "most recent wins".
function derive(verses: SavedVerse[]) {
  const singleByEntity: Record<string, SavedVerse> = {};
  const latest: Record<string, { color: string; at: string }> = {};
  for (const v of verses) {
    if (v.group_id == null) singleByEntity[v.entity_id] = v;
    if (v.highlight_color) {
      const cur = latest[v.entity_id];
      if (!cur || v.updated_at > cur.at) {
        latest[v.entity_id] = { color: v.highlight_color, at: v.updated_at };
      }
    }
  }
  const highlightByEntity: Record<string, string> = {};
  for (const k of Object.keys(latest)) highlightByEntity[k] = latest[k].color;
  return { singleByEntity, highlightByEntity };
}

// upsertSingle replaces (or adds) the standalone row for an entity, leaving any
// group rows for that entity untouched.
function upsertSingle(verses: SavedVerse[], row: SavedVerse): SavedVerse[] {
  const i = verses.findIndex((v) => v.entity_id === row.entity_id && v.group_id == null);
  if (i === -1) return [row, ...verses];
  const next = verses.slice();
  next[i] = row;
  return next;
}

const nowISO = () => new Date().toISOString();

interface BookmarksState {
  verses: SavedVerse[];
  singleByEntity: Record<string, SavedVerse>;
  highlightByEntity: Record<string, string>;
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  load: (filter?: string) => Promise<void>;
  save: (payload: {
    entity_id: string;
    reference: string;
    verse_text: string;
    highlight_color?: string | null;
    note?: string | null;
  }) => Promise<SavedVerse>;
  toggleHighlight: (entityId: string, reference: string, verseText: string, color: string) => Promise<void>;
  removeHighlight: (entityId: string) => Promise<void>;
  updateNote: (entityId: string, reference: string, verseText: string, note: string) => Promise<void>;
  remove: (entityId: string) => Promise<void>;
  createGroup: (
    verses: { entity_id: string; reference: string; verse_text: string }[],
    opts: { highlight_color?: string | null; note?: string | null },
  ) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  get: (entityId: string) => SavedVerse | null;
}

function setVerses(verses: SavedVerse[]) {
  return { verses, ...derive(verses) };
}

export const useBookmarksStore = create<BookmarksState>()((set, get) => ({
  verses: [],
  singleByEntity: {},
  highlightByEntity: {},
  loading: false,
  error: null,
  hydrated: false,

  load: async (filter?: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetchSavedVerses(filter);
      set({ ...setVerses(res.verses), loading: false, hydrated: true });
    } catch {
      set({ error: 'Failed to load saved verses', loading: false });
    }
  },

  save: async (payload) => {
    const verse = await saveVerse(payload);
    set((s) => setVerses(upsertSingle(s.verses, verse)));
    return verse;
  },

  toggleHighlight: async (entityId, reference, verseText, color) => {
    const existing = get().singleByEntity[entityId];
    const clearing = existing?.highlight_color === color;
    await setHighlight(entityId, clearing ? null : color);
    const base: SavedVerse = existing ?? {
      id: '',
      entity_id: entityId,
      reference,
      verse_text: verseText,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    set((s) =>
      setVerses(upsertSingle(s.verses, { ...base, highlight_color: clearing ? null : color, updated_at: nowISO() })),
    );
  },

  removeHighlight: async (entityId) => {
    await setHighlight(entityId, null);
    const existing = get().singleByEntity[entityId];
    if (!existing) return;
    set((s) =>
      setVerses(upsertSingle(s.verses, { ...existing, highlight_color: null, updated_at: nowISO() })),
    );
  },

  updateNote: async (entityId, reference, verseText, note) => {
    await setNote(entityId, note);
    const existing = get().singleByEntity[entityId];
    const base: SavedVerse = existing ?? {
      id: '',
      entity_id: entityId,
      reference,
      verse_text: verseText,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    set((s) => setVerses(upsertSingle(s.verses, { ...base, note, updated_at: nowISO() })));
  },

  remove: async (entityId) => {
    await deleteSavedVerse(entityId);
    set((s) => setVerses(s.verses.filter((v) => !(v.entity_id === entityId && v.group_id == null))));
  },

  createGroup: async (verses, opts) => {
    const rows = await createBookmarkGroup({
      verses,
      highlight_color: opts.highlight_color ?? null,
      note: opts.note ?? null,
    });
    set((s) => setVerses([...rows, ...s.verses]));
  },

  deleteGroup: async (groupId) => {
    await deleteBookmarkGroup(groupId);
    set((s) => setVerses(s.verses.filter((v) => v.group_id !== groupId)));
  },

  get: (entityId) => get().singleByEntity[entityId] ?? null,
}));
