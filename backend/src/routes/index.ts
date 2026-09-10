import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import webhookRoutes from './webhook.routes';
import reviewRoutes from './review.routes';
import returnRoutes from './return.routes';
import appealRoutes from './appeal.routes';
import couponRoutes from './coupon.routes';
import wishlistRoutes from './wishlist.routes';
import supportRoutes from './support.routes';
import adminRoutes from './admin.routes';
import cjRoutes from './cj.routes';
import scrapeRoutes from './scrape.routes';
import { runPriceSync } from '../jobs/priceSync';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/reviews', reviewRoutes);
router.use('/returns', returnRoutes);
router.use('/appeals', appealRoutes);
router.use('/coupons', couponRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/support', supportRoutes);
router.use('/admin', adminRoutes);
router.use('/admin', cjRoutes);
router.use('/scrape', scrapeRoutes);

// FASE 5 — CRON de sync de precios CJ.
// GET /api/cron/check-prices  → protegido por CRON_SECRET (.env).
// Se puede llamar con header `x-cron-secret: <secret>` o query `?secret=<secret>`.
router.get('/cron/check-prices', async (req, res) => {
  const expected = process.env.CRON_SECRET || '';
  const provided =
    String(req.headers['x-cron-secret'] || '') ||
    String((req.query as any).secret || '');
  if (!expected || provided !== expected) {
    res.status(401).json({ message: 'No autorizado: header x-cron-secret inválido.' });
    return;
  }
  try {
    const result = await runPriceSync();
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: 'Error en price sync', error: error.message });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'yesyes-backend' });
});

export default router;
