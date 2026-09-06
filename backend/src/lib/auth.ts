import { PrismaClient } from '@prisma/client';
import { loginUser } from '../services/auth.service';

const prisma = new PrismaClient();

let _authModules: { Auth: any; Google: any; Credentials: any } | null = null;

/**
 * import() dinámico "real".
 *
 * tsc con module:commonjs transpila `import()` a `require()`, y @auth/core es
 * ESM-only → en runtimes Node < 22 (Vercel) eso lanza ERR_REQUIRE_ESM y
 * provoca el 500 en /api/auth/*. Evaluando el import en runtime con
 * new Function() el compilador no lo toca y funciona en cualquier Node.
 */
const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;

/**
 * Hook de trazado para Vercel (node-file-trace).
 *
 * El empaquetador de lambdas solo detecta require()/import() ESTATICOS para
 * incluir dependencias en el bundle. Como el import de @auth/core es dinamico
 * y opaco (new Function), sin este require "muerto" el paquete (y sus deps:
 * jose, preact, oauth4webapi...) no viajan a la lambda y el runtime falla con
 * "Cannot find package '@auth/core'". La condicion nunca es verdadera, asi que
 * el require jamas se ejecuta (evitando ERR_REQUIRE_ESM en Node < 22).
 */
if ((globalThis as Record<string, unknown>).__YESYES_TRACE__ === '1') {
  require('@auth/core');
  // Los providers se cargan dinámicamente dentro de @auth/core, invisibles
  // para el trazo: sin estos requires, la lambda incluye el paquete pero SIN
  // providers/google.js ni providers/credentials.js y el login falla.
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
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
        let feOrigin: string;
        try {
          feOrigin = new URL(frontendUrl, baseUrl).origin;
        } catch {
          feOrigin = baseUrl;
        }

        let target: URL;
        try {
          // Resuelve urls relativas ("/perfil") contra el origin del request.
          // Auth.js resuelve el callbackUrl contra el BACKEND (api.yesyes.cl),
          // asi que sin esto el usuario aterriza en el dominio del API tras
          // el login (otro localStorage => parece deslogueado => loop).
          target = new URL(url, baseUrl);
        } catch {
          return frontendUrl;
        }

        // Las paginas internas de Auth.js (ej: /api/auth/error) viven en el backend
        if (target.pathname.startsWith('/api/auth')) return target.toString();

        // Ya apunta al frontend: respetalo tal cual
        if (target.origin === feOrigin) return target.toString();

        // Cualquier otra url (incluido el propio backend): mismo path en el frontend
        return `${feOrigin}${target.pathname}${target.search}${target.hash}`;
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
