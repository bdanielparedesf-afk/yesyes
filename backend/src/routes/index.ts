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
import { AliExpressOAuthError } from '../aliexpress/oauth-client';
import * as syncEngine from '../services/aliexpress-sync-engine.service';
import { refreshAliexpressToken } from '../jobs/aliexpress-token-refresh';
import aliexpressRoutes from './aliexpress.routes';

import businessRoutes from './business.routes';
import businessMediaRoutes from './business-media.routes';
import publicBusinessRoutes from './public-business.routes';
import businessSubscriptionRoutes from './business-subscription.routes';
import templateEngineRoutes from './template-engine.routes';
import designRoutes from './design.routes';
import mpOAuthRoutes from './mp-oauth.routes';
const router = Router();

router.use('/auth', authRoutes);
// Rutas MP por Business: /api/businesses/:businessId/mercadopago[/connect]
// (el frontend llama exactamente a estas rutas; ninguna ruta de
// business.routes coincide con estos segmentos, en cualquier orden de mount).
router.use('/businesses', mpOAuthRoutes);
// FASE 6 — MEDIOS (imagenes y video). Montado ANTES de `businessRoutes` para
// que sus rutas `/:id/media*` queden registradas; ninguna ruta existente
// coincide con esos segmentos, asi que no cambia el comportamiento anterior.
router.use('/businesses', businessMediaRoutes);
router.use('/businesses', businessRoutes);
router.use('/business', businessSubscriptionRoutes);
// TEMPLATE ENGINE V2 (Fase 3). Montado aparte de `business.routes` para no
// tocar ninguna ruta existente (compatibilidad V3 intacta).
router.use('/template-engine', templateEngineRoutes);
// DISEÑO Y VARIANTES (Fase 4.1). Permiten cambiar de diseño, cambiar la
// variante de una sección y agregar/quitar/reordenar, todo sobre el manifest
// con validación de backend y sin perder el contenido configurado.
router.use('/business', designRoutes);
router.use('/public/businesses', publicBusinessRoutes);
// Callback OAuth: /api/mercadopago/oauth/callback (redirect_uri registrada en MP)
router.use('/mercadopago', mpOAuthRoutes);
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
router.use('/admin/aliexpress', aliexpressRoutes);
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

// Optional authenticated trigger; no scheduler is installed.
// Only a private header is accepted; credentials must never appear in URLs.
router.get('/cron/refresh-aliexpress', async (req, res) => {
  const expected = process.env.CRON_SECRET || '';
  const provided = String(req.headers['x-cron-secret'] || '');
  if (!expected || provided !== expected) {
    res.status(401).json({ message: 'No autorizado: header x-cron-secret inválido.' });
    return;
  }
  try {
    await refreshAliexpressToken(); // Never serialize the returned access token.
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({ ok: false,
      code: error instanceof AliExpressOAuthError ? error.reason : 'OAUTH_STORAGE_ERROR',
      message: 'Renovación AliExpress no disponible; revisar estado OAuth de la cuenta.' });
  }
});

// FASE 6 — CRON del Sync Engine AliExpress (precio/stock/envío → YesYes).
// Respeta la configuración en aliexpress_sync_settings (enabled + intervalo);
// si aún no toca correr responde ok:true skipped. Protegido por CRON_SECRET.
router.get('/cron/sync-aliexpress', async (req, res) => {
  const expected = process.env.CRON_SECRET || '';
  const provided = String(req.headers['x-cron-secret'] || '') || String((req.query as any).secret || '');
  if (!expected || provided !== expected) {
    res.status(401).json({ message: 'No autorizado: header x-cron-secret inválido.' });
    return;
  }
  try {
    const settings = await syncEngine.getSyncSettings();
    const nextRun = syncEngine.nextRunFrom(settings);
    if (nextRun && nextRun.getTime() > Date.now()) {
      res.json({ ok: true, skipped: true, nextRunAt: nextRun.toISOString() });
      return;
    }
    const result = await syncEngine.runAliExpressSync();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: 'Error en sync engine AliExpress', error: error?.message });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'yesyes-backend' });
});

export default router;
