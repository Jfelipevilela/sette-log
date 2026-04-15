import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../lib/types';

type AuthState = {
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  setSession: (session: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      setSession: (session) => set(session),
      logout: () => set({ user: undefined, accessToken: undefined, refreshToken: undefined })
    }),
    {
      name: 'sette-log-session'
    }
  )
);
