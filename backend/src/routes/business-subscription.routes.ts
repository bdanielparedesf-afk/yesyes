import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthRequest } from '../middlewares/auth';
import { authenticate } from '../middlewares/auth';
import { prisma } from '../lib/prisma';
import {
  createSubscriptionCheckout,
  listActivePlans,
  getSubscriptionForBusiness,
  toSubscriptionDTO,
  cancelSubscription,
  reactivateSubscription,
  syncSubscriptionFromProvider,
} from '../services/business-subscription.service';
import { markPaymentPending } from '../services/business-publish.service';

const router = Router();
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);

async function authorizedBusiness(req: AuthRequest, businessId: string) {
  return prisma.business.findFirst({
    where: req.user?.role === 'ADMIN'
      ? { id: businessId }
      : { id: businessId, ownerId: req.user?.id },
    select: { id: true, name: true, status: true },
  });
}

router.get('/plans', async (_req: AuthRequest, res) => {
  res.json({ plans: await listActivePlans() });
});

router.post('/subscription/checkout', checkoutLimiter, async (req: AuthRequest, res) => {
  const businessId = String((req.body as any)?.businessId || '');
  const business = await authorizedBusiness(req, businessId);
  if (!business) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Negocio no encontrado' });
    return;
  }
  if (business.status === 'ARCHIVED') {
    res.status(409).json({ code: 'ARCHIVED', message: 'El negocio está archivado' });
    return;
  }

  try {
    const checkout = await createSubscriptionCheckout({
      businessId: business.id,
      businessName: business.name,
      payerEmail: req.user!.email,
    });
    await markPaymentPending(business.id);
    res.status(201).json(checkout);
  } catch (error: any) {
    res.status(error?.status || 502).json({
      code: error?.code || 'CHECKOUT_ERROR',
      message: error?.message || 'No fue posible iniciar el pago',
    });
  }
});

router.get('/subscription/status', async (req: AuthRequest, res) => {
  const businessId = String(req.query.businessId || '');
  if (!(await authorizedBusiness(req, businessId))) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Negocio no encontrado' });
    return;
  }
  const subscription = await getSubscriptionForBusiness(businessId);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ subscription: toSubscriptionDTO(subscription, businessId) });
});

router.post('/subscription/cancel', async (req: AuthRequest, res) => {
  const businessId = String((req.body as any)?.businessId || '');
  if (!(await authorizedBusiness(req, businessId))) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Negocio no encontrado' });
    return;
  }
  try {
    const result = await cancelSubscription(businessId);
    res.json({ ...result, subscription: toSubscriptionDTO(result.subscription, businessId) });
  } catch (error: any) {
    res.status(error?.status || 502).json({ message: error?.message || 'No fue posible cancelar' });
  }
});

router.post('/subscription/reactivate', async (req: AuthRequest, res) => {
  const businessId = String((req.body as any)?.businessId || '');
  if (!(await authorizedBusiness(req, businessId))) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Negocio no encontrado' });
    return;
  }
  try {
    const result = await reactivateSubscription(businessId);
    await syncSubscriptionFromProvider(businessId);
    res.json({ ...result, subscription: toSubscriptionDTO(result.subscription, businessId) });
  } catch (error: any) {
    res.status(error?.status || 502).json({ message: error?.message || 'No fue posible reactivar' });
  }
});

export default router;