import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  getSession,
  signIn as signInService,
  signOut as signOutService,
  register as registerService,
  login as loginService,
  Session,
} from '@/services/auth';

interface AuthState {
  user: Session['user'] | null;
  token: string | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  checkSession: () => Promise<void>;
  signIn: (provider?: 'google' | 'github' | string, callbackUrl?: string) => void;
  signOut: (callbackUrl?: string) => void;
  register: (data: { name: string; lastName: string; email: string; password: string; confirmPassword?: string }) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  setUser: (session: Session | null, token?: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      status: 'loading',
      checkSession: async () => {
        set({ status: 'loading' });
        const session = await getSession();
        if (session?.user) {
          set({ user: session.user, status: 'authenticated' });
        } else {
          set({ user: null, status: 'unauthenticated' });
        }
      },
      signIn: (provider = 'google', callbackUrl = '/') => {
        signInService(provider, callbackUrl);
      },
      signOut: (callbackUrl = '/login') => {
        signOutService(callbackUrl);
        set({ user: null, token: null, status: 'unauthenticated' });
      },
      register: async (data) => {
        const response = await registerService(data);
        const token = response.token;
        if (token) {
          set({
            user: { id: response.id, email: response.email, name: response.name },
            token,
            status: 'authenticated',
          });
        }
      },
      login: async (data) => {
        const response = await loginService(data);
        const token = response.token;
        if (token) {
          set({
            user: { id: response.id, email: response.email, name: response.name },
            token,
            status: 'authenticated',
          });
        }
      },
      setUser: (session, token = null) => {
        if (session?.user) {
          set({ user: session.user, token: token || null, status: 'authenticated' });
        } else {
          set({ user: null, token: null, status: 'unauthenticated' });
        }
      },
    }),
    {
      name: 'yesyes-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
