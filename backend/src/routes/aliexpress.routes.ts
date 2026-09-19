import { Router, RequestHandler, ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth';
import { disconnectAliExpress, getAliExpressAccounts } from '../services/aliexpress-token.service';
import {
  BROWSER_COOKIE, COOKIE_PATH, browserCookieOptions, createAliExpressBrowserOAuth, oauthBrowserConfig,
  readBrowserCookie,
} from '../services/aliexpress-browser-oauth';
import { AliExpressOAuthError } from '../aliexpress/oauth-client';
import * as syncEngine from '../services/aliexpress-sync-engine.service';
import {
  AliExpressDropshipError, createImportJob, getImportJobStatus, processImportJob, retryImportJobItem,
  previewAliExpressProduct, publishAliExpressProduct, syncAliExpressProduct, syncHistory,
  prepareAliExpressOrder, executeAliExpressOrder, simulateAliExpressOrder,
  getAliExpressOrder, getAliExpressTracking,
} from '../services/aliexpress-dropship.service';
import service from '../services/aliexpress-dropship.service';

const productIdSchema = z.string().regex(/^\d{5,32}$/);

/** True only when the browser really is on an HTTPS origin: drives cookie attributes. */
function isSecureBrowserContext(): boolean {
  try { return oauthBrowserConfig().secure; } catch { return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'; }
}

/** Redirect target for the panel. Falls back to the callback origin; never a raw user value. */
function oauthRedirectOrigin(): string {
  try {
    const frontend = new URL(process.env.FRONTEND_URL || '');
    if (frontend.protocol === 'https:' || (frontend.protocol === 'http:' && frontend.hostname === 'localhost')) {
      return frontend.origin;
    }
  } catch { /* Falls back to the registered callback origin below. */ }
  try { return new URL(oauthBrowserConfig().redirectUri).origin; } catch { return ''; }
}

const catalogueRoutes = (router: Router) => {
  router.post('/dropship/search', async (req, res, next) => {
    const input = z.object({ keywords: z.string().trim().min(1).max(200),
      page: z.number().int().min(1).max(99).optional(),
      pageSize: z.number().int().min(1).max(50).optional(),
      sort: z.string().trim().max(60).optional(),
      categoryId: z.string().trim().max(64).optional(),
    }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Parametros de busqueda invalidos.' }); return; }
    try { res.json(await service.searchText(input.data)); } catch (error) { next(error); }
  });
  router.post('/dropship/product', async (req, res, next) => {
    const input = z.object({ productId: productIdSchema,
      bizModel: z.enum(['WHOLESALE', 'DROPSHIPPING']).optional() }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'productId invalido.' }); return; }
    try { res.json(await service.productGet(input.data.productId, input.data.bizModel)); }
    catch (error) { next(error); }
  });
  router.post('/dropship/product/wholesale', async (req, res, next) => {
    const input = z.object({ productId: productIdSchema }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'productId invalido.' }); return; }
    try { res.json(await service.productWholesaleGet(input.data.productId)); }
    catch (error) { next(error); }
  });
  router.post('/dropship/freight', async (req, res, next) => {
    const input = z.object({ productId: productIdSchema,
      quantity: z.number().int().min(1).max(10000).default(1),
      selectedSkuId: z.string().trim().max(32).optional(),
      currency: z.literal('USD').optional(),
      provinceCode: z.string().trim().max(32).optional(),
      cityCode: z.string().trim().max(32).optional(),
    }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Parametros de freight invalidos.' }); return; }
    try {
      res.json(await service.freightQuery({
        productId: input.data.productId, quantity: input.data.quantity,
        ...(input.data.selectedSkuId ? { selectedSkuId: input.data.selectedSkuId } : {}),
        ...(input.data.currency ? { currency: input.data.currency } : {}),
        ...(input.data.provinceCode ? { provinceCode: input.data.provinceCode } : {}),
        ...(input.data.cityCode ? { cityCode: input.data.cityCode } : {}),
      }));
    } catch (error) { next(error); }
  });
  router.post('/dropship/freight/calculate', async (req, res, next) => {
    const input = z.object({ productId: productIdSchema,
      quantity: z.number().int().min(1).max(10000).default(1),
      skuId: z.string().trim().max(32).optional(),
      provinceCode: z.string().trim().max(32).optional(),
      cityCode: z.string().trim().max(32).optional(),
      price: z.string().trim().max(16).optional(),
    }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Parametros de calculo invalidos.' }); return; }
    try {
      res.json(await service.buyerFreightCalculate({
        product_id: input.data.productId, product_num: input.data.quantity,
        ...(input.data.skuId ? { sku_id: input.data.skuId } : {}),
        ...(input.data.provinceCode ? { province_code: input.data.provinceCode } : {}),
        ...(input.data.cityCode ? { city_code: input.data.cityCode } : {}),
        ...(input.data.price ? { price: input.data.price } : {}),
      }));
    } catch (error) { next(error); }
  });
  router.post('/dropship/image-search', async (req, res, next) => {
    const input = z.object({ imageBase64: z.string().trim().min(32).max(8000000) }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Imagen invalida.' }); return; }
    try { res.json(await service.imageSearch({ image_base64: input.data.imageBase64 })); }
    catch (error) { next(error); }
  });
  router.post('/dropship/categories/tree', async (_req, res, next) => {
    try { res.json(await service.categoryTree()); } catch (error) { next(error); }
  });
  router.post('/dropship/categories', async (req, res, next) => {
    const input = z.object({ categoryId: z.string().trim().regex(/^\d{1,16}$/) }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'categoryId invalido.' }); return; }
    try { res.json(await service.categoryGet(input.data.categoryId)); } catch (error) { next(error); }
  });
  router.post('/dropship/feed', async (req, res, next) => {
    try { res.json(await service.feedItemIdsGet(req.body)); } catch (error) { next(error); }
  });
};

export const dropshipRouteSections = { catalogueRoutes };

const importRoutes = (router: Router, preview = previewAliExpressProduct) => {
  router.post('/dropship/import/preview', async (req, res, next) => {
    // UI simplificada: solo URL + margen. El resto se genera automáticamente
    // (SKU desde variantes, quantity=1, destino CL). Se aceptan parámetros
    // legacy opcionales por compatibilidad, pero la UI ya no los envía.
    const input = z.object({ url: z.string().trim().min(1).max(2048),
      marginPercent: z.number().int().min(0).max(10000).optional(),
      selectedSkuId: z.string().regex(/^[1-9]\d{0,31}$/).optional(),
      quantity: z.number().int().min(1).max(10000).optional(),
      countryCode: z.literal('CL').optional(),
      provinceCode: z.string().trim().min(1).max(32).optional(),
      cityCode: z.string().trim().min(1).max(32).optional(),
      postalCode: z.string().trim().min(1).max(32).optional(),
      manualShippingUsd: z.number().finite().min(0).max(1000000).optional(),
    }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Parametros de cotizacion invalidos.' }); return; }
    const { url, marginPercent } = input.data;
    try { res.json(await preview(url, { marginPercent, quantity: 1, countryCode: 'CL' })); }
    catch (error) { next(error); }
  });
  router.post('/dropship/import/publish', async (req, res, next) => {
    const input = z.object({ categoryId: z.string().trim().min(1).max(64),
      marginPercent: z.number().int().min(0).max(10000).optional(),
      publish: z.boolean().optional(), preview: z.record(z.unknown()) }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Datos de publicacion invalidos.' }); return; }
    try {
      res.json(await publishAliExpressProduct({
        categoryId: input.data.categoryId, marginPercent: input.data.marginPercent,
        publish: input.data.publish === true, preview: input.data.preview as never,
      }));
    } catch (error) { next(error); }
  });
  router.post('/dropship/import/jobs', async (req, res, next) => {
    const input = z.object({ urls: z.array(z.string().trim().min(1).max(2048)).min(1).max(50),
      marginPercent: z.number().int().min(0).max(10000).optional(),
      categoryId: z.string().trim().min(1).max(64).nullable().optional() }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'URLs invalidas (1-50).' }); return; }
    try {
      const job = await createImportJob({ urls: input.data.urls, marginPercent: input.data.marginPercent,
        categoryId: input.data.categoryId ?? null,
        createdBy: String((req as unknown as { user?: { id?: unknown } }).user?.id ?? '') });
      // Fire-and-forget processing with per-item isolation; the job row is the
      // progress source of truth (see /dropship/import/jobs/:id).
      void processImportJob(job.id).catch(() => undefined);
      res.status(202).json(job);
    } catch (error) { next(error); }
  });
  router.get('/dropship/import/jobs/:id', async (req, res, next) => {
    try { res.json(await getImportJobStatus(req.params.id)); } catch (error) { next(error); }
  });
  router.post('/dropship/import/items/:id/retry', async (req, res, next) => {
    try { res.json(await retryImportJobItem(req.params.id)); } catch (error) { next(error); }
  });
  router.post('/dropship/sync/:productId', async (req, res, next) => {
    const input = z.object({ updateSalePrice: z.boolean().optional() }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Parametros de sync invalidos.' }); return; }
    try { res.json(await syncAliExpressProduct({ productId: req.params.productId, updateSalePrice: input.data.updateSalePrice })); }
    catch (error) { next(error); }
  });
  router.get('/dropship/sync/:productId/history', async (req, res, next) => {
    try { res.json(await syncHistory(req.params.productId)); } catch (error) { next(error); }
  });
  // ── Sync Engine: settings, manual run, stats, global history ──
  router.get('/dropship/sync-settings', async (_req, res, next) => {
    try { res.json(await syncEngine.getSyncSettings()); } catch (error) { next(error); }
  });
  router.put('/dropship/sync-settings', async (req, res, next) => {
    try { res.json(await syncEngine.updateSyncSettings(req.body)); } catch (error) { next(error); }
  });
  router.post('/dropship/sync-run', async (req, res, next) => {
    const input = z.object({ limit: z.number().int().min(1).max(200).optional() }).strict().safeParse(req.body ?? {});
    if (!input.success) { res.status(400).json({ message: 'Parametros de sync invalidos.' }); return; }
    try { res.json(await syncEngine.runAliExpressSync(input.data)); } catch (error) { next(error); }
  });
  router.get('/dropship/sync-stats', async (_req, res, next) => {
    try { res.json(await syncEngine.syncStats()); } catch (error) { next(error); }
  });
  router.get('/dropship/sync-logs', async (req, res, next) => {
    const take = z.coerce.number().int().min(1).max(100).catch(50).parse(req.query.take);
    try { res.json(await syncEngine.recentSyncLogs(undefined, take)); } catch (error) { next(error); }
  });
  router.post('/dropship/validate-order-price', async (req, res, next) => {
    const input = z.object({ productId: z.string().min(1).max(64),
      quantity: z.number().int().min(1).max(10000).optional() }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Parametros de validacion invalidos.' }); return; }
    try { res.json(await syncEngine.validateAliExpressProductForOrder(input.data)); } catch (error) { next(error); }
  });
};

const orderRoutes = (router: Router) => {
  router.post('/dropship/orders/prepare', async (req, res, next) => {
    try { res.json(await prepareAliExpressOrder(req.body)); } catch (error) { next(error); }
  });
  router.post('/dropship/orders/:orderId/simulate', async (req, res, next) => {
    try { res.json(await simulateAliExpressOrder(req.params.orderId)); } catch (error) { next(error); }
  });
  router.post('/dropship/orders/:orderId/execute', async (req, res, next) => {
    const input = z.object({ confirm: z.literal(true) }).strict().safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ message: 'Se requiere confirm:true explicito para ejecutar una orden real.' });
      return;
    }
    try { res.json(await executeAliExpressOrder(req.params.orderId, { confirm: true })); }
    catch (error) { next(error); }
  });
  router.get('/dropship/orders/:aeOrderId', async (req, res, next) => {
    try { res.json(await getAliExpressOrder(req.params.aeOrderId)); } catch (error) { next(error); }
  });
  router.get('/dropship/orders/:aeOrderId/tracking', async (req, res, next) => {
    try { res.json(await getAliExpressTracking(req.params.aeOrderId)); } catch (error) { next(error); }
  });
};

const dropshipErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AliExpressDropshipError) {
    const statusMap: Record<string, number> = {
      CONFIGURATION: 503, NOT_CONFIRMED: 400, BLOCKED: 403, INPUT: 400,
      DUPLICATE: 409, SHIPPING_UNKNOWN: 422,
    };
    const status = statusMap[error.reason] ?? 502;
    // Error code only: never the raw provider message (may leak internals).
    res.status(status).json({ message: error.message, code: error.reason });
    return;
  }
  res.status(503).json(error instanceof AliExpressOAuthError
    ? { message: error.message, code: error.reason }
    : { message: 'Servicio AliExpress no disponible.' });
};

/** Dependencies injectable for route tests; the mounted router always uses existing auth. */
export function createAliExpressRouter(dependencies: {
  authenticate: RequestHandler;
  requireAdmin: RequestHandler;
  accounts: typeof getAliExpressAccounts;
  disconnect: typeof disconnectAliExpress;
  preview?: typeof previewAliExpressProduct;
  oauth?: ReturnType<typeof createAliExpressBrowserOAuth>;
} = { authenticate, requireAdmin, accounts: getAliExpressAccounts, disconnect: disconnectAliExpress }) {
  const router = Router();
  const oauth = dependencies.oauth ?? createAliExpressBrowserOAuth();
  router.use(rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  /**
   * Official OAuth callback. Deliberately NOT behind the Bearer/requireAdmin middleware:
   * AliExpress returns with a top-level browser navigation. The one-time `state` plus the
   * HttpOnly browser nonce cookie bind the callback to the administrator who started it
   * (the attempt row is re-validated inside the service). No token or code is ever echoed.
   */
  router.get('/oauth/callback', async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const browser = readBrowserCookie(req.headers.cookie);
    res.clearCookie(BROWSER_COOKIE, { httpOnly: true, secure: isSecureBrowserContext(),
      sameSite: 'lax', path: COOKIE_PATH });
    // The provider error is reduced to a fixed identifier; its raw description is never forwarded.
    const errorCode = typeof req.query.error === 'string' && req.query.error ? 'OAUTH_PROVIDER_ERROR' : '';
    try {
      await oauth.callback(state, browser, code || undefined);
      res.redirect(303, `${oauthRedirectOrigin()}/admin/aliexpress?aliexpress=connected`);
    } catch (error) {
      const reason = error instanceof AliExpressOAuthError ? error.reason : 'OAUTH_STORAGE_ERROR';
      res.redirect(303, `${oauthRedirectOrigin()}/admin/aliexpress?aliexpress=error&code=${encodeURIComponent(errorCode || reason)}`);
    }
  });

  router.use(dependencies.authenticate, dependencies.requireAdmin);
  /**
   * Starts the official server-side OAuth: enables a reconnect without touching isActive.
   *
   * Security is enforced by:
   *   - Cookie session auth (authenticate) + admin role check (requireAdmin): the request
   *     must come from a logged-in ADMIN user identified by the Auth.js session cookie.
   *   - Custom header `x-yesyes-admin: 1`: a non-simple header that triggers a CORS preflight
   *     when sent cross-origin, and acts as an extra admin-only marker for same-origin POSTs.
   *
   * The Sec-Fetch-* headers are browser-controlled and MUST NOT be used for authorization:
   * JavaScript cannot set them reliably (they are forbidden headers), so any check depending
   * on them would either be bypassed by a direct curl/postman call or would break legitimate
   * same-origin requests when the browser decides to send a different value.
   */
  router.post('/oauth/connect', async (req: AuthRequest, res, next) => {
    // Admin marker header: only the admin panel sends this.
    if (req.get('x-yesyes-admin') !== '1') {
      res.status(403).json({ message: 'Solicitud administrativa invalida.' }); return;
    }
    const input = z.object({ account: z.string().trim().min(1).max(320).optional() }).strict().safeParse(req.body ?? {});
    if (!input.success || !req.user) { res.status(400).json({ message: 'Cuenta invalida.' }); return; }
    try {
      const started = await oauth.start(req.user.id, input.data.account);
      res.cookie(BROWSER_COOKIE, started.browser, browserCookieOptions(started.secure));
      // Only the authorization URL is returned: it carries no secret and no token.
      res.json({ authorizationUrl: started.authorizationUrl });
    } catch (error) {
      if (error instanceof AliExpressOAuthError) {
        const status = error.reason === 'OAUTH_CONFIGURATION_ERROR' ? 503 : error.reason === 'REJECTED' ? 403 : 502;
        res.status(status).json({ message: error.message, code: error.reason }); return;
      }
      next(error);
    }
  });
  router.get('/status', async (_req, res, next) => {
    try {
      const accounts = await dependencies.accounts();
      // Configuration is only reported as a boolean; no key/secret literals here.
      res.json({ configured: Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET),
        authenticationVerified: false, refreshAvailable: true, dropshipAvailable: true,
        orderExecutionEnabled: process.env.ALIEXPRESS_ORDER_EXECUTION === 'true',
        accounts: accounts.map(a => ({ account: a.account, sellerId: a.sellerId, expiresAt: a.expiresAt,
          refreshExpiresAt: a.refreshExpiresAt, isActive: a.isActive, tokenUnexpired: a.tokenUnexpired })),
      });
    } catch (error) { next(error); }
  });
  router.post('/disconnect', async (req, res, next) => {
    // Admin marker header: only the admin panel sends this.
    // The authenticate + requireAdmin middleware already guarantees a logged-in ADMIN user.
    if (req.get('x-yesyes-admin') !== '1') {
      res.status(403).json({ message: 'Solicitud administrativa invalida.' }); return;
    }
    const input = z.object({ account: z.string().trim().min(1).max(320) }).strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Cuenta invalida.' }); return; }
    try { await dependencies.disconnect(input.data.account); res.json({ disconnected: true, remoteRevoked: false }); }
    catch (error) { next(error); }
  });
  catalogueRoutes(router);
  importRoutes(router, dependencies.preview);
  orderRoutes(router);
  router.use(dropshipErrorHandler);
  return router;
}

export default createAliExpressRouter();
