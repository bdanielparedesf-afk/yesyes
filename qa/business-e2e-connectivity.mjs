import process from 'node:process';
import { CDP, launchChrome, sleep } from './business-qa-client.mjs';
import { prepareQaUser, cleanupQaData } from './business-e2e-fixture.mjs';
import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';
import { encode } from '../backend/node_modules/@auth/core/jwt.js';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';

dotenv.config({ path: new URL('../backend/.env', import.meta.url) });

const frontend = 'http://127.0.0.1:5173';
const backend = 'http://127.0.0.1:3001';
const prisma = new PrismaClient();
let chrome;
let client;
let qaUser;

async function probe(label, url, { expectJson = true } = {}) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    let json = false;
    try { JSON.parse(text); json = true; } catch { /* root is HTML */ }
    const pass = response.ok && (!expectJson || json) && !response.headers.has('location');
    console.log(`[${label}] ${pass ? 'PASS' : 'FAIL'}`);
    console.log(`  status=${response.status} ms=${Math.round(performance.now() - startedAt)} content-type=${response.headers.get('content-type') || 'none'} json=${json} redirect=${response.headers.has('location')}`);
    return { pass, status: response.status, json, ms: Math.round(performance.now() - startedAt) };
  } catch (error) {
    console.log(`[${label}] FAIL`);
    console.log(`  error=${error instanceof Error ? `${error.name}: ${error.message}` : String(error)} ms=${Math.round(performance.now() - startedAt)}`);
    return { pass: false, error: String(error), ms: Math.round(performance.now() - startedAt) };
  }
}

async function chromeFetch(url) {
  const result = await client.send('Runtime.evaluate', {
    expression: `(async () => {
      const startedAt = performance.now();
      try {
        const response = await fetch(${JSON.stringify(url)});
        const text = await response.text();
        let json = false;
        try { JSON.parse(text); json = true; } catch {}
        return { ok: response.ok, status: response.status, json, body: text, redirect: response.redirected, ms: Math.round(performance.now() - startedAt) };
      } catch (error) {
        return { ok: false, error: String(error), ms: Math.round(performance.now() - startedAt) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result?.value;
}

function printChrome(label, result, authenticated = false) {
  const pass = Boolean(result?.ok) && !result?.redirect && (authenticated ? result?.authenticated : true);
  console.log(`[${label}] ${pass ? 'PASS' : 'FAIL'}`);
  if (result?.error) console.log(`  error=${result.error}`);
  else console.log(`  status=${result?.status ?? 'none'} ms=${result?.ms ?? 'n/a'} json=${Boolean(result?.json)} redirect=${Boolean(result?.redirect)} authenticated=${Boolean(result?.authenticated)}`);
  return pass;
}

async function main() {
  const localhost = await probe('FRONTEND localhost', 'http://localhost:5173/', { expectJson: false });
  const loopback = await probe('FRONTEND 127.0.0.1', `${frontend}/`, { expectJson: false });
  const frontendApi = await probe('FRONTEND /api', `${frontend}/api/auth/session`);
  const backendHealth = await probe('BACKEND', `${backend}/api/health`);
  const frontendPublic = await probe('FRONTEND /api/public', `${frontend}/api/categories`);

  const launched = await launchChrome(process.cwd());
  chrome = launched.chrome;
  client = new CDP(launched.target.webSocketDebuggerUrl);
  await client.open();
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);

  await client.send('Page.navigate', { url: frontend });
  await sleep(1_500);
  const chromeRoot = await chromeFetch('/');
  const rootResult = printChrome('CHROME ROOT', chromeRoot);
  const chromeAnonymousSession = printChrome('CHROME /api/auth/session', await chromeFetch('/api/auth/session'));

  qaUser = await prepareQaUser(process.env.FINAL_RUN_ID || `connectivity-${Date.now()}`);
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET requerido solo en proceso QA');
  const token = await encode({
    token: { id: qaUser.userId, sub: qaUser.userId, email: qaUser.email, name: 'QA E2E', role: 'CUSTOMER' },
    secret,
    salt: 'authjs.session-token',
  });
  const response = await client.send('Network.setCookie', { name: 'authjs.session-token', value: token, url: frontend, path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }, { phase: 'PREFLIGHT', timeoutMs: 10_000, description: 'set QA auth cookie' });
  if (!response.success) throw new Error('Chrome rechazó la cookie QA');
  const cookieMetadata = (await client.send('Network.getCookies', { urls: [frontend] }, { phase: 'PREFLIGHT', description: 'get QA cookie metadata' })).cookies
    .filter(({ name }) => name === 'authjs.session-token')
    .map(({ name, domain, path, secure, sameSite }) => ({ name, domain, path, secure, sameSite }));
  console.log('[QA COOKIE]');
  console.log(`  ${JSON.stringify(cookieMetadata)} value=REDACTED`);
  const chromeQaSession = await chromeFetch('/api/auth/session');
  chromeQaSession.authenticated = chromeQaSession?.status === 200 && typeof chromeQaSession.body === 'string' && chromeQaSession.body.includes(qaUser.email);
  const qaSession = printChrome('QA SESSION', chromeQaSession, true);

  const results = [localhost.pass, loopback.pass, frontendApi.pass, backendHealth.pass, frontendPublic.pass, rootResult, chromeAnonymousSession, qaSession];
  if (results.some((result) => !result)) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(`[CONNECTIVITY] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  client?.close();
  chrome?.kill();
  if (qaUser) await cleanupQaData({ userId: qaUser.userId }).catch((error) => console.error('[CONNECTIVITY] cleanup exacto falló:', error?.message || error));
  await prisma.$disconnect();
}
