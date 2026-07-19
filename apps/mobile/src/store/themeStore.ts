import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AccentKey, AppTheme, ThemeMode } from '@/theme/colors';
import { buildTheme } from '@/theme/colors';

interface ThemeState {
  mode: ThemeMode;
  accent: AccentKey;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      accent: 'gold',

      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: 'saecula-theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// The one hook components use for colors. Subscribes to mode + accent, so
// every screen re-renders instantly on theme change.
export function useAppTheme(): AppTheme {
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  return buildTheme(mode, accent);
}
