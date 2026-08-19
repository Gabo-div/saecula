import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { checkinStreak, fetchStreak } from '@/api/client';
import type { ActivityType } from '@/types/api';

interface StreakState {
  current: number;
  best: number;
  todayDone: boolean;
  lastActiveDay: string | null;
  // refresh pulls the latest summary; errors are swallowed (best-effort).
  refresh: () => Promise<void>;
  // checkin credits today for the given activity. No-op when today is already
  // done. Fire-and-forget: a failure never blocks the devotional action.
  checkin: (type: ActivityType) => void;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      current: 0,
      best: 0,
      todayDone: false,
      lastActiveDay: null,

      refresh: async () => {
        try {
          const s = await fetchStreak();
          set({
            current: s.current,
            best: s.best,
            todayDone: s.todayDone,
            lastActiveDay: s.lastActiveDay,
          });
        } catch {
          // best-effort; keep cached values
        }
      },

      checkin: (type) => {
        if (get().todayDone) return;
        checkinStreak(type)
          .then((s) =>
            set({
              current: s.current,
              best: s.best,
              todayDone: s.todayDone,
              lastActiveDay: s.lastActiveDay,
            }),
          )
          .catch(() => {
            // best-effort; the next check-in or Home refresh reconciles
          });
      },
    }),
    {
      name: 'saecula-streak',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        current: s.current,
        best: s.best,
        todayDone: s.todayDone,
        lastActiveDay: s.lastActiveDay,
      }),
    },
  ),
);
