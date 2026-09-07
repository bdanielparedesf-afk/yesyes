import { PrismaClient } from '@prisma/client';
import { loginUser, getCurrentUser } from '../services/auth.service';
import { env } from '../config/env';
import '../config/env';

const prisma = new PrismaClient();

let _authModules: { Auth: any; Google: any; Credentials: any } | null = null;

if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL) {
  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    process.env.AUTH_URL = backendUrl;
    process.env.NEXTAUTH_URL = backendUrl;
  }
}

const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;

if ((globalThis as Record<string, unknown>).__YESYES_TRACE__ === '1') {
  require('@auth/core');
  require('@auth/core/providers/google');
  require('@auth/core/providers/credentials');
}

async function getAuthModules() {
  if (!_authModules) {
    const [coreModule, googleModule, credentialsModule] = await Promise.all([
      dynamicImport('@auth/core'),
      dynamicImport('@auth/core/providers/google'),
      dynamicImport('@auth/core/providers/credentials'),
    ]);
    _authModules = { Auth: coreModule.Auth, Google: googleModule.default, Credentials: credentialsModule.default };
  }
  return _authModules;
}

function createAuthConfig(google: (opts: any) => any, credentials: (opts: any) => any) {
  const isProduction = process.env.NODE_ENV === 'production';
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'bdanielparedesf@gmail.com').toLowerCase().trim();

  const providers: any[] = [
    credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      authorize: async (credentials: any) => {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const result = await loginUser(credentials.email, credentials.password);
          return { id: result.id, email: result.email, name: result.name, role: result.role };
        } catch (error) {
          return null;
        }
      },
    }),
  ];

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    providers.push(
      google({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        authorization: {
          url: 'https://accounts.google.com/o/oauth2/v2/auth',
          params: {
            prompt: 'consent',
            access_type: 'offline',
            response_type: 'code',
          },
        },
      }),
    );
  }

  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || env.authSecret;

  if (!authSecret) {
    console.error(
      '[AUTH_CONFIG_ERROR] Missing: ' +
        [
          !process.env.AUTH_SECRET ? 'AUTH_SECRET' : '',
          !process.env.NEXTAUTH_SECRET ? 'NEXTAUTH_SECRET' : '',
        ]
          .filter(Boolean)
          .join(', '),
    );
  }

  return {
    providers,
    secret: authSecret,
    basePath: '/api/auth',
    trustHost: true,
    useSecureCookies: isProduction,
    cookies: {
      sessionToken: {
        name: 'authjs.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
          ...(isProduction ? { domain: '.yesyes.cl' } : {}),
        },
      },
      csrfToken: {
        name: 'authjs.csrf-token',
        options: {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
        },
      },
    },
    callbacks: {
      async signIn({ user, account }: { user: any; account: any }) {
        if (!account || !user?.email) return false;

        try {
          const normalizedEmail = user.email.toLowerCase().trim();

          const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (existingUser) {
            // Garantizar que el email configurado como admin siempre tenga rol ADMIN
            if (normalizedEmail === ADMIN_EMAIL && existingUser.role !== 'ADMIN') {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { role: 'ADMIN' },
              });
            }

            await prisma.account.upsert({
              where: {
                userId_provider_providerAccountId: {
                  userId: existingUser.id,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              update: {},
              create: {
                userId: existingUser.id,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            });

            if (!existingUser.googleId && account.provider === 'google') {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { googleId: account.providerAccountId, emailVerified: true },
              });
            }

            return true;
          }

          const isAdmin = normalizedEmail === ADMIN_EMAIL;

          const newUser = await prisma.user.create({
            data: {
              email: normalizedEmail,
              name: user.name || '',
              lastName: '',
              googleId: account.providerAccountId,
              emailVerified: true,
              role: isAdmin ? 'ADMIN' : 'CUSTOMER',
              isActive: true,
            },
          });

          await prisma.account.create({
            data: {
              userId: newUser.id,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          });

          return true;
        } catch (error) {
          return false;
        }
      },
      async jwt({ token, user, account }: { token: any; user?: any; account?: any }) {
        if (user?.email) {
          token.email = user.email;
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email.toLowerCase().trim() },
              select: { id: true, role: true },
            });
            if (dbUser) {
              // IMPORTANTE: usar siempre el id de nuestra BD. En logins con Google,
              // `user.id` es el id de la cuenta de Google (sub de Google), no el de la BD.
              token.id = dbUser.id;
              token.sub = dbUser.id;
              token.role = dbUser.role;
            } else {
              token.id = user.id;
              token.role = token.role || 'CUSTOMER';
            }
          } catch {
            token.id = user.id;
          }
        }

        if (token.id && !token.role) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { role: true, email: true },
          });
          if (dbUser) {
            token.email = dbUser.email;
            token.role = dbUser.role;
          }
        }

        return token;
      },
      async session({ session, token }: { session: any; token: any }) {
        if (session?.user && token) {
          session.user.id = token.id as string;
          session.user.email = token.email as string;
          session.user.role = token.role as string;
        }
        return session;
      },
      async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
        const frontendUrl = process.env.FRONTEND_URL || baseUrl;
        let feOrigin: string;
        try {
          feOrigin = new URL(frontendUrl, baseUrl).origin;
        } catch {
          feOrigin = baseUrl;
        }

        let target: URL;
        try {
          target = new URL(url, baseUrl);
        } catch {
          return frontendUrl;
        }

        if (target.pathname.startsWith('/api/auth')) return target.toString();

        if (target.origin === feOrigin) return target.toString();

        return `${feOrigin}${target.pathname}${target.search}${target.hash}`;
      },
    },
  };
}

export async function handleAuth(request: Request): Promise<Response> {
  try {
    let origin = '';
    // Estrategia 1: extraer origin de la URL absoluta del request
    try {
      origin = new URL(request.url).origin;
    } catch {
      origin = '';
    }

    // Estrategia 2: si la URL es relativa, reconstruir desde headers (Host / x-forwarded-host)
    if (!origin || origin === 'null') {
      const host =
        request.headers.get('host') ||
        request.headers.get('x-forwarded-host') ||
        '';
      const forwardedProto = request.headers.get('x-forwarded-proto');
      const proto = forwardedProto
        ? (forwardedProto.split(',')[0] ?? 'https').trim()
        : 'https';
      if (host) {
        origin = `${proto}://${host}`.replace(/\/$/, '');
      }
    }

    // Estrategia 3: fallback a BACKEND_URL o localhost
    if (!origin || origin === 'null') {
      origin = process.env.BACKEND_URL || 'http://localhost:3001';
    }

    // En producción, forzar HTTPS
    if (process.env.NODE_ENV === 'production' && origin.startsWith('http://')) {
      origin = origin.replace('http://', 'https://');
    }
    process.env.AUTH_URL = origin;
    process.env.NEXTAUTH_URL = origin;

    const { Auth, Google, Credentials } = await getAuthModules();
    const config = createAuthConfig(Google, Credentials);

    return Auth(request, config);
  } catch (error: any) {
    const message = error?.message || 'Auth configuration error';
    const stack = error?.stack ? String(error.stack).split('\n').slice(0, 5).join('\n') : '';
    console.error('[Auth] Configuration error:', message, stack);
    if (error?.cause) console.error('[Auth] cause:', error.cause);
    const response = new Response(
      JSON.stringify({ error: 'Configuration', message, stack }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
    return response;
  }
}

export async function handleAuthError(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const errorType = url.searchParams.get('error') || 'UnknownError';

    if (errorType === 'OAuthCallback' || errorType === 'access_denied') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/login?error=${encodeURIComponent('Error en la autenticación con Google. Por favor, intenta de nuevo.')}`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      });
    }

    if (errorType === 'AccessDenied') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/login?error=${encodeURIComponent('Acceso denegado. Por favor, intenta de nuevo.')}`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/login?error=${encodeURIComponent('Error de autenticación. Por favor, intenta de nuevo.')}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/login` },
    });
  }
}
