import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../lib/types';

type AuthState = {
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  lastActivityAt?: number;
  setSession: (session: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  touchActivity: () => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      setSession: (session) =>
        set({
          ...session,
          lastActivityAt: Date.now(),
        }),
      touchActivity: () => set({ lastActivityAt: Date.now() }),
      logout: () =>
        set({
          user: undefined,
          accessToken: undefined,
          refreshToken: undefined,
          lastActivityAt: undefined,
        }),
    }),
    {
      name: 'sette-log-session',
    },
  ),
);
