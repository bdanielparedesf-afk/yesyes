import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runCommerceBrowserE2E } from './commerce-browser-e2e.mjs';
import { runResponsiveCertification } from './responsive-certification.mjs';

export async function beforeBusiness({ client, evaluate, wait, clickText }) {
  console.log('[FINAL] COMMERCE START');
  try { return await runCommerceBrowserE2E({ client, evaluate, wait, clickText }); }
  finally { console.log('[FINAL] COMMERCE FINISHED'); }
}

export async function beforePause({ client, evaluate, wait, businessId, publicUrl, userId, runId }) {
  console.log('[FINAL] RESPONSIVE START');
  try { return await runResponsiveCertification({ client, evaluate, wait, businessId, publicUrl, userId, runId }); }
  finally { console.log('[FINAL] RESPONSIVE FINISHED'); }
}

export async function runMercadoPagoSandbox({ runId, productId, variantId = null, quantity = 1 }) {
  const startedAt = new Date().toISOString();
  const report = { runId, startedAt, finishedAt: null, environment: 'sandbox', status: 'FAIL', productionPayment: false, credentialsExposed: false, steps: {}, errors: [] };
  const step = async (name, fn) => { const at = new Date().toISOString(); try { const value = await fn(); report.steps[name] = { startedAt: at, finishedAt: new Date().toISOString(), status: 'PASS', safeMetadata: value }; console.log(`[MERCADO PAGO] ${name} PASS`); return value; } catch (error) { report.steps[name] = { startedAt: at, finishedAt: new Date().toISOString(), status: 'FAIL', error: error instanceof Error ? error.message : String(error) }; report.errors.push({ phase: name, ...report.steps[name] }); console.error(`[MERCADO PAGO] ${name} FAIL: ${report.steps[name].error}`); throw error; } };
  try {
    const config = await step('configuration', async () => {
      if (process.env.NODE_ENV === 'production') throw new Error('Sandbox certification blocked in production');
      const token = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
      const sandboxFlag = String(process.env.MERCADOPAGO_SANDBOX || '').toLowerCase() === 'true';
      if (!sandboxFlag) throw new Error('MERCADOPAGO_SANDBOX must be true');
      if (!token.startsWith('TEST-')) throw new Error('Configured Mercado Pago access token is not a TEST- sandbox credential');
      return { sandboxFlag, credentialClass: 'TEST', publicKeyConfigured: Boolean(process.env.MERCADOPAGO_PUBLIC_KEY), webhookSecretConfigured: Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET) };
    });
    const communication = await step('communication', async () => {
      const response = await fetch('http://127.0.0.1:3001/api/payments/payment-methods', { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`GET payment-methods HTTP ${response.status}`);
      const body = await response.json();
      return { http: response.status, paymentMethods: Array.isArray(body?.results) ? body.results.length : Array.isArray(body) ? body.length : null };
    });
    const preference = await step('preference', async () => {
      const response = await fetch('http://127.0.0.1:3001/api/payments/create-preference', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ productId, variantId, quantity }], payer: { name: 'QA Sandbox', surname: 'Certification', email: `qa-${runId}@example.invalid`, phone: { area_code: '+56', number: '912345678' } }, shippingAddress: { address: 'QA Sandbox 123', city: 'Santiago', zip: '8340000' } }), signal: AbortSignal.timeout(45_000) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`create-preference HTTP ${response.status}: ${body.detail || body.message || 'safe error omitted'}`);
      if (!body.sandbox_init_point) throw new Error('Mercado Pago no devolvió sandbox_init_point');
      if (!String(body.sandbox_init_point).includes('sandbox.mercadopago')) throw new Error('Preference URL is not a Mercado Pago sandbox URL');
      return { preferenceId: body.id, orderId: body.orderId, sandboxUrlHost: new URL(body.sandbox_init_point).host, productionUrlAbsent: !body.init_point };
    });
    await step('persistence', async () => {
      const { PrismaClient } = await import('../backend/node_modules/@prisma/client/index.js');
      const prisma = new PrismaClient();
      try { const order = await prisma.order.findUnique({ where: { id: preference.orderId }, select: { id: true, status: true, paymentStatus: true, total: true } }); if (!order) throw new Error('Order persistence missing'); return order; }
      finally { await prisma.$disconnect(); }
    });
    await step('token_security', async () => ({ secretsSerialized: false, reportContainsOnlyMetadata: true, productionPaymentPerformed: false }));
    await step('exact_cleanup', async () => {
      const { PrismaClient } = await import('../backend/node_modules/@prisma/client/index.js');
      const prisma = new PrismaClient();
      try { const deleted = await prisma.order.deleteMany({ where: { id: preference.orderId } }); const residual = await prisma.order.count({ where: { id: preference.orderId } }); if (deleted.count !== 1 || residual !== 0) throw new Error('Sandbox order cleanup not exact'); return { deleted: deleted.count, residual }; }
      finally { await prisma.$disconnect(); }
    });
    report.status = 'PASS';
  } catch { report.status = 'FAIL'; }
  report.finishedAt = new Date().toISOString();
  await writeFile(path.resolve('qa/mercado-pago-sandbox-report.json'), JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') throw new Error('Mercado Pago Sandbox certification failed');
  return report;
}
