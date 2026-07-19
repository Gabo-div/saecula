import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { User } from '@/types/api';

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  user: User | null;
  isAuthenticated: () => boolean;
  setSession: (token: string, expiresAt: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      user: null,

      isAuthenticated: () => {
        const { token, expiresAt } = get();
        if (!token || !expiresAt) return false;
        return new Date(expiresAt).getTime() > Date.now();
      },

      setSession: (token, expiresAt, user) =>
        set({ token, expiresAt, user }),

      logout: () => set({ token: null, expiresAt: null, user: null }),
    }),
    {
      name: 'saecula-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
