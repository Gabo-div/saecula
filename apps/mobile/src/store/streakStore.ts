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
  // Transient (not persisted): the streak count to celebrate when a check-in
  // completes today for the first time, else null. A root overlay watches it.
  celebrate: number | null;
  // Transient guard so two near-simultaneous check-ins don't both celebrate.
  checkingIn: boolean;
  // refresh pulls the latest summary; errors are swallowed (best-effort).
  refresh: () => Promise<void>;
  // checkin credits today for the given activity. No-op when today is already
  // done. Fire-and-forget: a failure never blocks the devotional action.
  checkin: (type: ActivityType) => void;
  clearCelebrate: () => void;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      current: 0,
      best: 0,
      todayDone: false,
      lastActiveDay: null,
      celebrate: null,
      checkingIn: false,

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
        const st = get();
        if (st.todayDone || st.checkingIn) return;
        set({ checkingIn: true });
        checkinStreak(type)
          .then((s) => {
            const firstToday = !get().todayDone && s.todayDone;
            set({
              current: s.current,
              best: s.best,
              todayDone: s.todayDone,
              lastActiveDay: s.lastActiveDay,
              checkingIn: false,
              celebrate: firstToday ? s.current : get().celebrate,
            });
          })
          .catch(() => {
            // best-effort; the next check-in or Home refresh reconciles
            set({ checkingIn: false });
          });
      },

      clearCelebrate: () => set({ celebrate: null }),
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
