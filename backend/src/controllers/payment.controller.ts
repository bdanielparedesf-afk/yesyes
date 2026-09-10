import { Request, Response } from 'express';
import { getPreferenceClient, getPublicKey } from '../integrations/mercadopago';
import { MercadoPagoConfig, Payment, PaymentMethod, WebhookSignatureValidator } from 'mercadopago';
import { createOrder } from '../services/order.service';
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

/**
 * Garantiza que cada item del carrito apunte a un producto REAL de la BD.
 *
 * Si el carrito contiene un producto que ya no existe (fue borrado, la tabla
 * se vació al re-importar, o el carrito es viejo), la FK
 * `order_items.product_id → products.id` fallaba con P2003 y el checkout
 * devolvía 500 ("Error al procesar el pago") SIN explicación.
 *
 * Ahora, si el producto no existe, se recrea una ficha mínima en estado DRAFT
 * (no aparece en la tienda) para conservar la integridad referencial y el
 * historial de la orden, y el pago puede continuar.
 */
async function resolveCartItemProductId(item: {
  id?: string;
  productId?: string;
  title?: string;
  name?: string;
  price?: number;
  image?: string;
}): Promise<string> {
  const requestedId = String(item.id || item.productId || '').trim();

  if (requestedId) {
    const existing = await prisma.product.findUnique({
      where: { id: requestedId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const name = (String(item.title || item.name || 'Producto').trim() || 'Producto').slice(0, 120);
  const price = Number(item.price) || 0;

  const category =
    (await prisma.category.findUnique({ where: { slug: 'general' } })) ??
    (await prisma.category.create({ data: { name: 'General', slug: 'general' } }));

  const rescued = await prisma.product.create({
    data: {
      name,
      slug: `recuperado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description:
        'Ficha recreada automáticamente desde un carrito antiguo (el producto original ya no existe en el catálogo).',
      images: item.image ? [String(item.image)] : [],
      categoryId: category.id,
      productCost: price,
      totalCost: price,
      salePrice: price,
      margin: 0,
      variants: [],
      status: 'DRAFT',
      importSource: 'CART_RECOVERY',
    },
    select: { id: true },
  });

  console.log(`[payments] Producto faltante recreado como DRAFT (${rescued.id}): ${name}`);
  return rescued.id;
}

export const createPaymentPreference = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, payer, total } = req.body;

    if (!items || items.length === 0) {
      res.status(400).json({ message: 'items are required' });
      return;
    }

    for (const item of items) {
      if (!item.price || Number(item.price) <= 0) {
        res.status(400).json({
          message: 'unit_price invalid',
          detail: `Producto ${item.title} sin precio válido. En producción MP no acepta $0`,
        });
        return;
      }
    }

    const mpItems = items.map((item: any) => ({
      id: String(item.id || item.productId || ''),
      title: String(item.title || item.name || 'Producto'),
      description: String(item.variant || ''),
      quantity: Math.max(1, Number(item.quantity) || 1),
      unit_price: Number(item.price),
      currency_id: 'CLP',
      ...(item.image ? { picture_url: String(item.image) } : {}),
    }));

    const itemsTotal = mpItems.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0);
    const clientTotal = Number(total) || 0;
    const shippingCost = Math.max(0, Math.round((clientTotal - itemsTotal) * 100) / 100);

    if (shippingCost > 0) {
      mpItems.push({ id: 'envio', title: 'Envío', description: '', quantity: 1, unit_price: shippingCost, currency_id: 'CLP' });
    }

    // Resolver cada ítem contra un producto REAL de la BD. Si el producto del
    // carrito ya no existe (fue borrado o re-importado), se recrea una ficha
    // mínima en DRAFT para conservar la FK order_items.productId y el pago no
    // truene con "Foreign key constraint violated: order_items_productId_fkey".
    const orderItems: Array<{
      productId: string;
      productName: string;
      productImage: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      variant?: any;
      variantId?: string;
    }> = [];

    for (const i of mpItems) {
      if (i.id === 'envio') {
        orderItems.push({
          productId: '', // placeholder que se completa abajo con producto de costo cero
          productName: i.title,
          productImage: '',
          quantity: 1,
          unitPrice: i.unit_price,
          totalPrice: i.unit_price,
          variant: undefined,
          variantId: undefined,
        });
        continue;
      }
      const resolvedProductId = await resolveCartItemProductId({
        id: i.id,
        title: i.title,
        price: i.unit_price,
        image: i.picture_url,
      });
      orderItems.push({
        productId: resolvedProductId,
        productName: i.title,
        productImage: i.picture_url || '',
        quantity: i.quantity,
        unitPrice: i.unit_price,
        totalPrice: i.unit_price * i.quantity,
        variant: i.description || undefined,
        variantId: undefined,
      });
    }

    // El ítem de envío no es un producto real: usa como FK el primer producto de
    // la orden (siempre existe tras resolver), con costo 0 en la ficha.
    const envioIndex = orderItems.findIndex((o) => o.productId === '');
    if (envioIndex >= 0) {
      const envioItem = orderItems[envioIndex];
      if (envioItem) {
        envioItem.productId =
          orderItems.find((o) => o.productId !== '')?.productId ??
          (await resolveCartItemProductId({ title: 'Producto', price: 0 }));
      }
    }

    const order = await createOrder({
      userId: (req as any).user?.id,
      items: orderItems,
      subtotal: itemsTotal,
      shipping: shippingCost,
      discount: 0,
      total: clientTotal > 0 ? clientTotal : itemsTotal + shippingCost,
      shippingAddress: {},
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

    if (!accessToken) {
      res.status(500).json({ message: 'Mercado Pago access token not configured' });
      return;
    }

    const mpConfig = new MercadoPagoConfig({ accessToken });
    const paymentClient = new Payment(mpConfig);

    const payment = await paymentClient.get({ id: String(paymentId) });

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
      console.warn('MERCADOPAGO_WEBHOOK_SECRET not configured, skipping validation');
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
