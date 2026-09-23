import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireBusinessOwner } from '../middlewares/businessAuth';
import { oauthLimiter } from '../middlewares/rateLimiter';
import {
  startMercadoPagoConnection,
  mercadoPagoOAuthCallback,
  getMercadoPagoStatus,
  disconnectMercadoPago,
} from '../controllers/mp-oauth.controller';

const router = Router();

router.post(
  '/:businessId/mercadopago/connect',
  authenticate,
  requireBusinessOwner,
  oauthLimiter,
  startMercadoPagoConnection,
);

router.get('/oauth/callback', oauthLimiter, mercadoPagoOAuthCallback);

router.get(
  '/:businessId/mercadopago',
  authenticate,
  requireBusinessOwner,
  getMercadoPagoStatus,
);

router.delete(
  '/:businessId/mercadopago',
  authenticate,
  requireBusinessOwner,
  oauthLimiter,
  disconnectMercadoPago,
);

export default router;