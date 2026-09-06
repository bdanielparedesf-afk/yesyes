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
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
  };
}

export async function handleAuth(request: Request): Promise<Response> {
  const { Auth, Google, Credentials } = await getAuthModules();
  const config = createAuthConfig(Google, Credentials);
  return Auth(request, config);
}
