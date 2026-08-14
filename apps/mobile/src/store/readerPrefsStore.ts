import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Reader accessibility: a font-size multiplier applied to Bible and Catechism
// body text, adjustable from each reader's settings sheet.
export const FONT_STEPS = [0.88, 1, 1.14, 1.32] as const;

interface ReaderPrefsState {
  fontScale: number;
  setFontScale: (scale: number) => void;
}

export const useReaderPrefs = create<ReaderPrefsState>()(
  persist(
    (set) => ({
      fontScale: 1,
      setFontScale: (fontScale) => set({ fontScale }),
    }),
    {
      name: 'saecula-reader-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
