import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';
dotenv.config({ path: new URL('../backend/.env', import.meta.url) });
const prisma = new PrismaClient();
const PREFIX = 'qa-e2e-';
const PLAN_CODE = 'QA_E2E_PLAN';
const active = process.env.BUSINESS_QA_E2E === '1' && process.env.NODE_ENV !== 'production';
function requireQa() { if (!active) throw new Error('Fixture deshabilitada: requiere BUSINESS_QA_E2E=1 y NODE_ENV distinto de production'); }
function marked(value) { if (!String(value).startsWith(PREFIX)) throw new Error('Identificador fuera del namespace QA'); return value; }
export async function createQaUser(suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`) { requireQa(); const email = `${PREFIX}${suffix}@example.invalid`; return prisma.user.upsert({ where: { email }, update: { name: 'QA E2E', lastName: 'Browser', isActive: true }, create: { email, name: 'QA E2E', lastName: 'Browser', password: null, isActive: true } }); }
export async function createQaBusiness(ownerId, { name = 'QA Flores E2E', slug = `${PREFIX}flowers-${Date.now()}`, category = 'FLOWERS' } = {}) { requireQa(); const safeSlug = marked(slug); const safeName = String(name).startsWith(PREFIX) ? name : `QA ${name}`; return prisma.business.upsert({ where: { slug: safeSlug }, update: { ownerId, name: safeName, category, status: 'DRAFT' }, create: { ownerId, name: safeName, slug: safeSlug, category, status: 'DRAFT' } }); }
export async function attachQaSubscription(businessId) { requireQa(); const plan = await prisma.businessPlan.upsert({ where: { code: PLAN_CODE }, update: { active: true }, create: { code: PLAN_CODE, name: 'QA E2E Plan', amount: 0, currency: 'CLP', features: ['qa-e2e'], active: true, order: 9999 } }); const now = new Date(); const periodEnd = new Date(now.getTime() + 30 * 86400000); const data = { planId: plan.id, provider: 'QA_E2E', status: 'ACTIVE', amount: 0, currency: 'CLP', frequency: 1, frequencyType: 'MONTH', currentPeriodStart: now, currentPeriodEnd: periodEnd, nextPaymentAt: periodEnd, activatedAt: now, lastPaymentAt: now }; return prisma.businessSubscription.upsert({ where: { businessId: String(businessId) }, update: data, create: { businessId: String(businessId), ...data } }); }
export async function cleanupQaData({ userId, businessId } = {}) { requireQa(); const scopedUserId = userId ? String(userId) : null; const businesses = scopedUserId && businessId ? await prisma.business.findMany({ where: { id: String(businessId), ownerId: scopedUserId, OR: [{ slug: { startsWith: PREFIX } }, { slug: { contains: PREFIX } }] }, select: { id: true } }) : scopedUserId ? await prisma.business.findMany({ where: { ownerId: scopedUserId }, select: { id: true } }) : await prisma.business.findMany({ where: { OR: [{ slug: { contains: PREFIX } }, { owner: { email: { startsWith: PREFIX } } }] }, select: { id: true } }); const businessIds = businesses.map((item) => item.id); if (businessIds.length) { await prisma.businessSubscription.deleteMany({ where: { businessId: { in: businessIds } } }); await prisma.business.deleteMany({ where: { id: { in: businessIds } } }); } const users = await prisma.user.deleteMany({ where: scopedUserId ? { id: scopedUserId, email: { startsWith: PREFIX } } : { email: { startsWith: PREFIX } } }); return { businesses: businessIds.length, users: users.count }; }
export async function prepareQaUser() { const user = await createQaUser(); return { userId: user.id, email: user.email }; }
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] || 'prepare';
  try { requireQa(); const result = command === 'cleanup' ? await cleanupQaData() : await prepareQaUser(); console.log(JSON.stringify({ command, result })); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; } finally { await prisma.$disconnect(); }
}
