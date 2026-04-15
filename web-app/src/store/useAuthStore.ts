import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  uuid: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  setAuth: (data: { user: User; accessToken: string; refreshToken?: string; sessionId?: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      setAuth: (data) =>
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || null,
          sessionId: data.sessionId || null,
        }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, sessionId: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
