import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';
dotenv.config({ path: new URL('../backend/.env', import.meta.url) });
const prisma = new PrismaClient();
export const PREFIX = 'qa-e2e-';
export const PLAN_CODE = 'QA_E2E_PLAN';
const active = process.env.BUSINESS_QA_E2E === '1' && process.env.NODE_ENV !== 'production';
function requireQa() { if (!active) throw new Error('Fixture deshabilitada: requiere BUSINESS_QA_E2E=1 y NODE_ENV distinto de production'); }
function marked(value) { if (!String(value).startsWith(PREFIX)) throw new Error('Identificador fuera del namespace QA'); return value; }
export async function createQaUser(runId, suffix = runId) {
  requireQa();
  if (!runId || !/^[A-Za-z0-9-]{8,80}$/.test(runId)) throw new Error('runId QA inválido');
  const email = `${PREFIX}${suffix}@example.invalid`;
  return prisma.user.create({ data: { email, name: `QA CERT ${runId}`, lastName: 'Browser', password: null, isActive: true } });
}
export async function createQaBusiness(ownerId, { name = 'QA Flores E2E', slug = `${PREFIX}flowers-${Date.now()}`, category = 'FLOWERS' } = {}) { requireQa(); const safeSlug = marked(slug); const safeName = String(name).startsWith(PREFIX) ? name : `QA ${name}`; return prisma.business.create({ data: { ownerId, name: safeName, slug: safeSlug, category, status: 'DRAFT' } }); }
export async function attachQaSubscription(businessId) { requireQa(); const plan = await prisma.businessPlan.upsert({ where: { code: PLAN_CODE }, update: { active: true }, create: { code: PLAN_CODE, name: 'QA E2E Plan', amount: 0, currency: 'CLP', features: ['qa-e2e'], active: true, order: 9999 } }); const now = new Date(); const periodEnd = new Date(now.getTime() + 30 * 86400000); const data = { planId: plan.id, provider: 'QA_E2E', status: 'ACTIVE', amount: 0, currency: 'CLP', frequency: 1, frequencyType: 'MONTH', currentPeriodStart: now, currentPeriodEnd: periodEnd, nextPaymentAt: periodEnd, activatedAt: now, lastPaymentAt: now }; return prisma.businessSubscription.upsert({ where: { businessId: String(businessId) }, update: data, create: { businessId: String(businessId), ...data } }); }
export async function cleanupQaData({ userId, businessId } = {}) {
  requireQa();
  if (!userId) throw new Error('Cleanup exacto requiere userId de esta corrida');
  const createdResources = { userIds: [String(userId)], businessIds: businessId ? [String(businessId)] : [], orderIds: [] };
  if (businessId) {
    const business = await prisma.business.findFirst({ where: { id: String(businessId), ownerId: String(userId) }, select: { id: true } });
    if (business) {
      const orders = await prisma.order.findMany({ where: { userId: String(userId) }, select: { id: true } });
      createdResources.orderIds = orders.map((item) => item.id);
      if (createdResources.orderIds.length) await prisma.order.deleteMany({ where: { id: { in: createdResources.orderIds } } });
      await prisma.businessSubscription.deleteMany({ where: { businessId: business.id } });
      await prisma.business.deleteMany({ where: { id: business.id, ownerId: String(userId) } });
    }
  }
  const user = await prisma.user.deleteMany({ where: { id: String(userId), email: { startsWith: PREFIX } } });
  const residualUser = await prisma.user.count({ where: { id: String(userId) } });
  const residualBusiness = businessId ? await prisma.business.count({ where: { id: String(businessId), ownerId: String(userId) } }) : 0;
  return {
    createdResources,
    deletedResources: { users: user.count, businesses: businessId ? Number(residualBusiness === 0) : 0 },
    preservedResources: { scope: 'only userId/businessId supplied by current run', arbitraryQaDataDeleted: false },
    residual: residualUser + residualBusiness,
    preexistingPreserved: true,
  };
}
export async function prepareQaUser(runId) { const user = await createQaUser(runId); return { userId: user.id, email: user.email }; }
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] || 'prepare';
  try { requireQa(); const result = command === 'prepare' ? await prepareQaUser(process.argv[3] || randomUUID()) : { error: 'Cleanup CLI bloqueado: requiere userId y businessId explícitos' }; console.log(JSON.stringify({ command, result })); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; } finally { await prisma.$disconnect(); }
}
