import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  getSession,
  signIn as signInService,
  signOut as signOutService,
  register as registerService,
  login as loginService,
  verifyToken,
  Session,
} from '@/services/auth';

const ADMIN_EMAIL = 'bdanielparedesf@gmail.com';

/**
 * Tras un login con Google, la página de retorno se recarga completa.
 * Si la marca `yesyes_post_login` está presente (la pone el botón de Google
 * en Login.tsx), redirigimos UNA sola vez: el admin a /admin y el resto de
 * usuarios al inicio (/). Así cada quien aterriza donde le corresponde.
 */
function consumePostLoginRedirect(user: { email?: string; role?: string } | null | undefined) {
  try {
    if (sessionStorage.getItem('yesyes_post_login') !== '1') return;
    sessionStorage.removeItem('yesyes_post_login');
    const isAdmin =
      user?.email?.toLowerCase().trim() === ADMIN_EMAIL || user?.role === 'ADMIN';
    const target = isAdmin ? '/admin' : '/';
    if (window.location.pathname !== target) {
      window.location.assign(target);
    }
  } catch {
    // sessionStorage no disponible → ignorar
  }
}

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
    (set, get) => ({
      user: null,
      token: null,
      status: 'loading',
      checkSession: async () => {
        set({ status: 'loading' });
        const session = await getSession();
        if (session?.user) {
          set({ user: session.user, status: 'authenticated' });
          consumePostLoginRedirect(session.user);
          return;
        }

        // Fallback: el login con email/contraseña usa un JWT propio (NO crea la
        // cookie de sesión de Auth.js que /auth/session lee). Sin este fallback,
        // al recargar /admin el usuario era pateado a /login.
        const token = get().token;
        if (token) {
          const meUser = await verifyToken(token);
          if (meUser) {
            set({
              user: {
                id: meUser.id,
                email: meUser.email,
                name: meUser.name,
                role: meUser.role,
                image: meUser.image,
              },
              status: 'authenticated',
            });
            consumePostLoginRedirect(meUser);
            return;
          }
        }

        set({ user: null, token: null, status: 'unauthenticated' });
      },
      signIn: (provider = 'google', callbackUrl = '/') => {
        signInService(provider, callbackUrl);
      },
      signOut: (callbackUrl = '/') => {
        signOutService(callbackUrl);
        set({ user: null, token: null, status: 'unauthenticated' });
      },
      register: async (data) => {
        const response = await registerService(data);
        const token = response.token;
        if (token) {
          set({
            user: { id: response.id, email: response.email, name: response.name, role: response.role },
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
            user: { id: response.id, email: response.email, name: response.name, role: response.role },
            token,
            status: 'authenticated',
          });
        }
      },
      setUser: (session, token = null) => {
        if (session?.user) {
          set({ user: { id: session.user.id, email: session.user.email, name: session.user.name, role: (session.user as any).role }, token: token || null, status: 'authenticated' });
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
