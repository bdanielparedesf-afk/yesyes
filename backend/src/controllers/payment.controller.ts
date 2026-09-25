import { Request, Response } from 'express';
import { getPreferenceClient, getPublicKey } from '../integrations/mercadopago';
import { MercadoPagoConfig, Payment, PaymentMethod, WebhookSignatureValidator } from 'mercadopago';
import { createOrder } from '../services/order.service';
import { resolveTrustedCheckout } from '../services/checkout-pricing.service';
import { prisma } from '../lib/prisma';

const configuredFrontend = process.env.FRONTEND_URL?.replace(/\/$/, '') || '';
const configuredBackend = process.env.BACKEND_URL?.replace(/\/$/, '') || '';

/**
 * Las back_urls y el notification_url son URLs PÚBLICAS a las que Mercado Pago
 * (o el navegador del comprador) llegan después del pago. MP rechaza URLs de
 * localhost/HTTP con el error "auto_return invalid. back_url.success must be
 * defined" (invalid_auto_return), por eso SIEMPRE apuntan al sitio público en
 * HTTPS, aunque el backend esté corriendo localmente.
 */
const SITE_URL = configuredFrontend.startsWith('https://') ? configuredFrontend : 'https://yesyes.cl';

/**
 * El notification_url debe apuntar al BACKEND (donde vive el webhook), no al
 * frontend. En Vercel, el rewrite /api/* enruta al serverless function del
 * backend, por lo que SITE_URL también funciona. Pero usamos BACKEND_URL de
 * forma explícita cuando está disponible y es HTTPS; si no, caemos al SITE_URL.
 */
const API_URL =
  (configuredBackend.startsWith('https://') ? configuredBackend : '') || SITE_URL;

export const createPaymentPreference = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, payer, shippingAddress } = req.body;
    const checkout = await resolveTrustedCheckout(items);
    const mpItems = checkout.lines.map((line) => ({
      id: line.variantId ? `${line.productId}-${line.variantId}` : line.productId,
      title: line.name.slice(0, 120),
      description: line.sku ? `SKU: ${line.sku}`.slice(0, 120) : '',
      quantity: line.quantity,
      unit_price: line.unitPrice,
      currency_id: 'CLP',
      ...(line.image ? { picture_url: line.image } : {}),
    }));
    if (checkout.shipping > 0) {
      mpItems.push({ id: 'yesyes-shipping', title: 'Envío', description: '', quantity: 1, unit_price: checkout.shipping, currency_id: 'CLP' });
    }
    const orderItems = checkout.lines.map((line) => ({
      productId: line.productId,
      productName: line.name,
      productImage: line.image || '',
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.totalPrice,
      variant: line.sku ? { sku: line.sku } : undefined,
      variantId: line.variantId || undefined,
    }));

    const order = await createOrder({
      userId: (req as any).user?.id,
      items: orderItems,
      subtotal: checkout.subtotal,
      shipping: checkout.shipping,
      discount: 0,
      total: checkout.total,
      shippingAddress: shippingAddress && typeof shippingAddress === 'object' ? shippingAddress : {},
    });

    // SITE_URL / API_URL ya incluyen el fallback HTTPS (https://yesyes.cl) por si
    // FRONTEND_URL / BACKEND_URL no est�n configuradas. Mercado Pago RECHAZA las
    // preferencias cuando back_urls o notification_url son URLs relativas o HTTP.
    // El notification_url apunta al webhook real (/webhooks/mercadopago), no a
    // /payments/webhook que no es ninguna ruta registrada.
    const preferenceData: any = {
      items: mpItems,
      external_reference: order.id,
      back_urls: {
        success: `${SITE_URL}/payment/success`,
        failure: `${SITE_URL}/payment/failure`,
        pending: `${SITE_URL}/payment/pending`,
      },
      auto_return: 'approved',
      notification_url: `${API_URL}/api/webhooks/mercadopago`,
    };

    if (payer) {
      const email = String(payer.email || '').trim();
      const payerData: any = {
        ...(String(payer.name || '').trim() ? { name: String(payer.name).trim() } : {}),
        ...(String(payer.surname || '').trim() ? { surname: String(payer.surname).trim() } : {}),
        ...(email.includes('@') && email.includes('.') ? { email } : {}),
      };
      const rawPhone = String(payer.phone?.number || '').replace(/[^0-9]/g, '');
      if (rawPhone) {
        const areaCode = String(payer.phone?.area_code || '56').replace(/[^0-9]/g, '') || '56';
        payerData.phone = { area_code: areaCode, number: rawPhone };
      }
      if (Object.keys(payerData).length > 0) {
        preferenceData.payer = payerData;
      }
    }

    const publicKey = getPublicKey();
    const preferenceClient = getPreferenceClient();
    const response = await preferenceClient.create({ body: preferenceData });

    res.status(200).json({
      id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
      public_key: publicKey,
      orderId: order.id,
    });
  } catch (error: any) {
    console.error('Error creating payment preference:', error?.message || error);
    if (error?.error) console.error('Mercado Pago API error:', JSON.stringify(error.error));
    if (error?.causes) console.error('Mercado Pago causes:', JSON.stringify(error.causes));

    const httpStatus = error?.status || 500;
    const detail = error?.cause || error?.message || 'Error desconocido';

    res.status(httpStatus).json({
      message: 'Error creating payment preference',
      detail,
      ...(error?.status ? { mp_status: error.status } : {}),
      ...(MP_ERROR_MAP[error?.name] ? { error_type: MP_ERROR_MAP[error?.name] } : {}),
    });
  }
};

const MP_ERROR_MAP: Record<string, string> = {
  MPBadRequestError: 'bad_request',
  MPAuthenticationError: 'authentication_error',
  MPPaymentError: 'payment_error',
  MPForbiddenError: 'forbidden',
  MPNotFoundError: 'not_found',
  MPIdempotencyError: 'idempotency_conflict',
  MPValidationError: 'validation_error',
  MPRateLimitError: 'rate_limit',
  MPResourceLockedError: 'resource_locked',
  MPDependencyError: 'dependency_error',
  MPServerError: 'server_error',
  MPConnectionError: 'connection_error',
  MercadoPagoError: 'mercadopago_error',
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Inicia sesión para consultar el pago' });
      return;
    }

    if (!accessToken) {
      res.status(500).json({ message: 'Mercado Pago access token not configured' });
      return;
    }

    const mpConfig = new MercadoPagoConfig({ accessToken });
    const paymentClient = new Payment(mpConfig);

    const payment = await paymentClient.get({ id: String(paymentId) });
    const order = await prisma.order.findFirst({
      where: { id: String(payment.external_reference || ''), userId },
      select: { id: true },
    });
    if (!order) {
      res.status(404).json({ message: 'Pago no encontrado' });
      return;
    }

    res.status(200).json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_amount: payment.transaction_amount,
      date_approved: payment.date_approved,
      date_created: payment.date_created,
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ message: 'Error fetching payment status' });
  }
};

export const getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      res.status(500).json({ message: 'Mercado Pago access token not configured' });
      return;
    }

    const mpConfig = new MercadoPagoConfig({ accessToken });
    const paymentMethodClient = new PaymentMethod(mpConfig);

    const response = await paymentMethodClient.get({});

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ message: 'Error fetching payment methods' });
  }
};

export const validateWebhook = (req: Request): boolean => {
  try {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') return false;
      console.warn('MERCADOPAGO_WEBHOOK_SECRET not configured; accepting webhook only outside production');
      return true;
    }

    WebhookSignatureValidator.validate({
      xSignature: req.headers['x-signature'] as string | string[] | undefined | null,
      xRequestId: req.headers['x-request-id'] as string | string[] | undefined | null,
      dataId: req.query.data_id as string | string[] | undefined | null,
      secret,
      toleranceSeconds: 300,
    });

    return true;
  } catch (error) {
    console.error('Webhook signature validation failed:', error);
    return false;
  }
};
