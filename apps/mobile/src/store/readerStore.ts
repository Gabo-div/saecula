import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ReaderState {
  // Where the Bible reader is currently open, persisted across launches.
  bookCode: string;
  chapter: number;
  // Pinned edition; empty lets the backend pick a default for the language.
  translationId: string;
  // Transient: a verse the reader should scroll to and briefly highlight
  // (set by search). Not persisted — cleared once handled.
  targetVerse: number | null;
  setLocation: (bookCode: string, chapter: number, verse?: number) => void;
  setTranslation: (translationId: string) => void;
  clearTarget: () => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      bookCode: 'GEN',
      chapter: 1,
      translationId: '',
      targetVerse: null,

      setLocation: (bookCode, chapter, verse) =>
        set({ bookCode, chapter, targetVerse: verse ?? null }),
      setTranslation: (translationId) => set({ translationId }),
      clearTarget: () => set({ targetVerse: null }),
    }),
    {
      name: 'saecula-reader',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        bookCode: s.bookCode,
        chapter: s.chapter,
        translationId: s.translationId,
      }),
    },
  ),
);
