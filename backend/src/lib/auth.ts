import { PrismaClient } from '@prisma/client';
import { loginUser } from '../services/auth.service';

const prisma = new PrismaClient();

let _authModules: { Auth: any; Google: any; Credentials: any } | null = null;

async function getAuthModules() {
  if (!_authModules) {
    const [coreModule, googleModule, credentialsModule] = await Promise.all([
      import('@auth/core'),
      import('@auth/core/providers/google'),
      import('@auth/core/providers/credentials'),
    ]);
    _authModules = { Auth: coreModule.Auth, Google: googleModule.default, Credentials: credentialsModule.default };
  }
  return _authModules;
}

function createAuthConfig(google: (opts: any) => any, credentials: (opts: any) => any) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    providers: [
      credentials({
        name: 'Email',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Contraseña', type: 'password' },
        },
        authorize: async (credentials: any) => {
          if (!credentials?.email || !credentials?.password) return null;
          try {
            const user = await loginUser(credentials.email, credentials.password);
            return { id: user.id, email: user.email, name: user.name };
          } catch (error) {
            return null;
          }
        },
      }),
      google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
          },
        },
      }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    basePath: '/api/auth',
    trustHost: true,
    cookies: {
      useSecureCookies: isProduction,
    },
    callbacks: {
      async signIn({ user, account }: { user: any; account: any }) {
        if (!account || !user?.email) return false;

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existingUser) {
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
          return true;
        }

        const newUser = await prisma.user.create({
          data: {
            email: user.email,
            name: user.name || '',
            lastName: '',
            googleId: account.providerAccountId,
            emailVerified: true,
            role: 'CUSTOMER',
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
      },
      async jwt({ token, user }: { token: any; user?: any }) {
        if (user) {
          token.id = user.id;
          token.email = user.email;
        }
        return token;
      },
      async session({ session, token }: { session: any; token: any }) {
        if (session?.user && token) {
          session.user.id = token.id as string;
          session.user.email = token.email as string;
        }
        return session;
      },
      async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
        const frontendUrl = process.env.FRONTEND_URL || baseUrl;
        if (url.startsWith('/')) return `${frontendUrl}${url}`;
        if (new URL(url).origin === new URL(frontendUrl).origin) return url;
        if (new URL(url).origin === baseUrl) return url;
        return frontendUrl;
      },
    },
  };
}

export async function handleAuth(request: Request): Promise<Response> {
  const { Auth, Google, Credentials } = await getAuthModules();
  const config = createAuthConfig(Google, Credentials);

  // En producción el frontend y la API viven en dominios distintos
  // (yesyes.cl / api.yesyes.cl). Forzamos que Auth.js construya las URLs
  // de acción a partir del host real de la petición para que los callbacks
  // de OAuth (Google) apunten siempre al backend correcto.
  try {
    const origin = new URL(request.url).origin;
    process.env.AUTH_URL = origin;
    process.env.NEXTAUTH_URL = origin;
  } catch {}

  return Auth(request, config);
}
