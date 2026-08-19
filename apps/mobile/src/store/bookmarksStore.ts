import { create } from 'zustand';

import {
  fetchSavedVerses,
  saveVerse,
  setHighlight,
  setNote,
  deleteSavedVerse,
} from '@/api/client';
import type { SavedVerse } from '@/types/api';

interface BookmarksState {
  verses: SavedVerse[];
  loading: boolean;
  error: string | null;
  byEntity: Record<string, SavedVerse>;
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
  get: (entityId: string) => SavedVerse | null;
}

export const useBookmarksStore = create<BookmarksState>()((set, get) => ({
  verses: [],
  loading: false,
  error: null,
  byEntity: {},
  hydrated: false,

  load: async (filter?: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetchSavedVerses(filter);
      const byEntity: Record<string, SavedVerse> = {};
      for (const v of res.verses) {
        byEntity[v.entity_id] = v;
      }
      set({ verses: res.verses, byEntity, loading: false, hydrated: true });
    } catch {
      set({ error: 'Failed to load saved verses', loading: false });
    }
  },

  save: async (payload) => {
    const verse = await saveVerse(payload);
    set((s) => ({
      byEntity: { ...s.byEntity, [verse.entity_id]: verse },
    }));
    return verse;
  },

  toggleHighlight: async (entityId, reference, verseText, color) => {
    const existing = get().byEntity[entityId];
    if (existing?.highlight_color === color) {
      await setHighlight(entityId, null);
      set((s) => {
        const updated = { ...s.byEntity };
        if (updated[entityId]) {
          updated[entityId] = { ...updated[entityId], highlight_color: null };
        }
        return { byEntity: updated };
      });
    } else {
      await setHighlight(entityId, color);
      set((s) => ({
        byEntity: {
          ...s.byEntity,
          [entityId]: {
            ...(s.byEntity[entityId] ?? {
              id: '',
              entity_id: entityId,
              reference,
              verse_text: verseText,
              created_at: '',
              updated_at: '',
            }),
            highlight_color: color,
          },
        },
      }));
    }
  },

  removeHighlight: async (entityId) => {
    await setHighlight(entityId, null);
    set((s) => {
      const updated = { ...s.byEntity };
      if (updated[entityId]) {
        updated[entityId] = { ...updated[entityId], highlight_color: null };
      }
      return { byEntity: updated };
    });
  },

  updateNote: async (entityId, reference, verseText, note) => {
    await setNote(entityId, note);
    set((s) => ({
      byEntity: {
        ...s.byEntity,
        [entityId]: {
          ...(s.byEntity[entityId] ?? {
            id: '',
            entity_id: entityId,
            reference,
            verse_text: verseText,
            created_at: '',
            updated_at: '',
          }),
          note,
        },
      },
    }));
  },

  remove: async (entityId) => {
    await deleteSavedVerse(entityId);
    set((s) => {
      const updated = { ...s.byEntity };
      delete updated[entityId];
      return {
        byEntity: updated,
        verses: s.verses.filter((v) => v.entity_id !== entityId),
      };
    });
  },

  get: (entityId) => get().byEntity[entityId] ?? null,
}));
