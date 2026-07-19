import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ReaderState {
  // Where the Bible reader is currently open, persisted across launches.
  bookCode: string;
  chapter: number;
  // Pinned edition; empty lets the backend pick a default for the language.
  translationId: string;
  setLocation: (bookCode: string, chapter: number) => void;
  setTranslation: (translationId: string) => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      bookCode: 'GEN',
      chapter: 1,
      translationId: '',

      setLocation: (bookCode, chapter) => set({ bookCode, chapter }),
      setTranslation: (translationId) => set({ translationId }),
    }),
    {
      name: 'saecula-reader',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
