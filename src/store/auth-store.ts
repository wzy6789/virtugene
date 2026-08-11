import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  userId: string | null;
  username: string | null;
  apiKey: string | null;
  isLoggedIn: boolean;

  login: (userId: string, username: string, apiKey: string) => void;
  logout: () => void;
  setApiKey: (apiKey: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      username: null,
      apiKey: null,
      isLoggedIn: false,

      login: (userId, username, apiKey) =>
        set({ userId, username, apiKey, isLoggedIn: true }),

      logout: () =>
        set({ userId: null, username: null, apiKey: null, isLoggedIn: false }),

      setApiKey: (apiKey) => set({ apiKey }),
    }),
    {
      name: 'virtugene-auth',
    }
  )
);
