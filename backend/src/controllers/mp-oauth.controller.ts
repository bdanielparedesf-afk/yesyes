import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';
import {
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
  createOAuthAttempt,
  validateAndConsumeOAuthAttempt,
  markOAuthAttemptSuccess,
  markOAuthAttemptError,
  hashState,
} from '../services/mercado-pago-oauth-state.service';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  disconnectBusinessMercadoPago,
  getMercadoPagoConnectionStatus,
  validateOAuthConfig,
  MercadoPagoOAuthError,
} from '../services/mercado-pago-oauth.service';

/**
 * POST /api/businesses/:businessId/mercadopago/connect
 * Inicia el flujo OAuth para conectar Mercado Pago a un Business.
 */
export const startMercadoPagoConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const businessId = String(req.params.businessId);

    try {
      validateOAuthConfig();
    } catch (error) {
      const msg = error instanceof MercadoPagoOAuthError ? error.message : 'Configuración OAuth inválida';
      res.status(500).json({ message: msg });
      return;
    }

    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
      select: { id: true, name: true },
    });

    if (!business) {
      res.status(404).json({ message: 'Negocio no encontrado o no eres dueño' });
      return;
    }

    const existingConnection = await prisma.businessMercadoPago.findUnique({
      where: { businessId },
    });

    if (existingConnection?.connectionStatus === 'CONNECTED') {
      res.status(400).json({ message: 'Este negocio ya tiene Mercado Pago conectado' });
      return;
    }

    const state = generateOAuthState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    await createOAuthAttempt(businessId, req.user!.id, state, codeVerifier);

    const authorizationUrl = buildAuthorizationUrl(state, codeChallenge);

    res.json({
      authorizationUrl,
      state,
      businessId,
    });
  } catch (error) {
    console.error('[mp-oauth] Error iniciando conexión');
    res.status(500).json({ message: 'Error al iniciar conexión con Mercado Pago' });
  }
};

/**
 * GET /api/mercadopago/oauth/callback
 * Callback OAuth de Mercado Pago.
 */
export const mercadoPagoOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: errorParam } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (errorParam) {
      console.warn('[mp-oauth] Callback con error');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_error=${encodeURIComponent(String(errorParam).slice(0, 100))}`);
      return;
    }

    if (!state || !code) {
      console.warn('[mp-oauth] Callback sin state o code');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_error=credentials_missing`);
      return;
    }

    if (typeof state !== 'string' || !/^[a-f\d]{64}$/i.test(state) || typeof code !== 'string' || code.length === 0 || code.length > 4096) {
      console.warn('[mp-oauth] Callback con formato inválido');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_error=invalid_state`);
      return;
    }

    const attemptData = await validateAndConsumeOAuthAttempt(state);

    if (!attemptData) {
      console.warn('[mp-oauth] State inválido/expirado/reutilizado');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_error=invalid_state`);
      return;
    }

    const { businessId, userId, codeVerifierForExchange } = attemptData;

    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
      select: { id: true },
    });

    if (!business) {
      await markOAuthAttemptError(hashState(state), 'Business no encontrado');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_error=business_not_found`);
      return;
    }

    let mpUserId: string;
    try {
      const tokenResult = await exchangeAuthorizationCode(code, codeVerifierForExchange, businessId);
      mpUserId = tokenResult.mpUserId;
      await markOAuthAttemptSuccess(hashState(state), mpUserId);
    } catch (err) {
      const msg = err instanceof MercadoPagoOAuthError ? err.message : 'Error al conectar';
      await markOAuthAttemptError(hashState(state), msg);
      console.error('[mp-oauth] Error en token exchange');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_error=token_exchange_failed`);
      return;
    }

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_connected=true`);
  } catch (err) {
    console.error('[mp-oauth] Error en callback');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/negocio?mp_error=internal_error`);
  }
};

/**
 * GET /api/businesses/:businessId/mercadopago
 * Obtiene el estado de conexión de Mercado Pago de un Business.
 */
export const getMercadoPagoStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const businessId = String(req.params.businessId);

    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
      select: { id: true },
    });

    if (!business) {
      res.status(404).json({ message: 'Negocio no encontrado o no eres dueño' });
      return;
    }

    const status = await getMercadoPagoConnectionStatus(businessId);

    if (!status) {
      res.json({ connected: false, status: 'NOT_CONNECTED' });
      return;
    }

    res.json({
      connected: status.connected,
      status: status.status,
      mpUserId: status.mpUserId,
      connectedAt: status.connectedAt,
      lastVerifiedAt: status.lastVerifiedAt,
      expiresAt: status.expiresAt,
      sandbox: status.sandbox,
    });
  } catch (err) {
    console.error('[mp-oauth] Error obteniendo estado');
    res.status(500).json({ message: 'Error al obtener estado de Mercado Pago' });
  }
};

/**
 * DELETE /api/businesses/:businessId/mercadopago
 * Desconecta Mercado Pago de un Business.
 */
export const disconnectMercadoPago = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const businessId = String(req.params.businessId);

    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
      select: { id: true },
    });

    if (!business) {
      res.status(404).json({ message: 'Negocio no encontrado o no eres dueño' });
      return;
    }

    await disconnectBusinessMercadoPago(businessId);

    res.json({ success: true, message: 'Mercado Pago desconectado correctamente' });
  } catch (err) {
    console.error('[mp-oauth] Error al desconectar');
    res.status(500).json({ message: 'Error al desconectar Mercado Pago' });
  }
};
