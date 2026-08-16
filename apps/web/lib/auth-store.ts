'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  email: string | null
  role: string | null
  setSession: (session: { token: string; email: string; role: string }) => void
  clear: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      role: null,
      setSession: ({ token, email, role }) => set({ token, email, role }),
      clear: () => set({ token: null, email: null, role: null }),
    }),
    { name: 'saecula-admin-auth' },
  ),
)
