import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deviceLanguage } from '@/i18n';
import type { LanguageCode } from '@/types/api';

interface LanguageState {
  // UI + content language sent as ?lang= to the backend. The preferred
  // text edition lives in readerStore.translationId (app-wide).
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      // First launch: follow the device locale; afterwards the persisted
      // choice wins (rehydrated over this default).
      language: deviceLanguage(),

      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'saecula-language',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
