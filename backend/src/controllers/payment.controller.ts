import { Request, Response } from 'express';
import { getPreferenceClient, getPublicKey } from '../integrations/mercadopago';
import { MercadoPagoConfig, Payment, PaymentMethod, WebhookSignatureValidator } from 'mercadopago';
import { createOrder } from '../services/order.service';
import { prisma } from '../lib/prisma';

const configuredFrontend = process.env.FRONTEND_URL?.replace(/\/$/, '') || '';

/**
 * Las back_urls y el notification_url son URLs PÚBLICAS a las que Mercado Pago
 * (o el navegador del comprador) llegan después del pago. MP rechaza URLs de
 * localhost/HTTP con el error "auto_return invalid. back_url.success must be
 * defined" (invalid_auto_return), por eso SIEMPRE apuntan al sitio público en
 * HTTPS, aunque el backend esté corriendo localmente.
 */
const SITE_URL = configuredFrontend.startsWith('https://') ? configuredFrontend : 'https://yesyes.cl';

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

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'items are required' });
      return;
    }

    const normalizedItems = [];
    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.price) || 0;
      normalizedItems.push({
        productId: await resolveCartItemProductId(item),
        productName: String(item.title || item.name || 'Producto'),
        productImage: String(item.image || ''),
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        variant: item.variant || null,
        variantId: item.variantId || null,
      });
    }

    const itemsTotal = normalizedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const clientTotal = Number(total) || 0;
    // El frontend manda el total CON envío; Mercado Pago cobra la suma de items.
    // Agregamos el envío como item para que el cobro coincida con lo mostrado.
    const shippingCost = Math.max(0, Math.round((clientTotal - itemsTotal) * 100) / 100);
    const finalTotal = clientTotal > 0 ? clientTotal : itemsTotal;

    const order = await createOrder({
      userId: (req as any).user?.id,
      items: normalizedItems,
      subtotal: itemsTotal,
      shipping: shippingCost,
      discount: 0,
      total: finalTotal,
      shippingAddress: {},
    });

    const mpItems: any[] = normalizedItems.map((item) => ({
      id: item.productId,
      title: item.productName,
      description: item.variant || '',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      ...(item.productImage ? { picture_url: item.productImage } : {}),
    }));
    if (shippingCost > 0) {
      mpItems.push({ id: 'envio', title: 'Envío', description: '', quantity: 1, unit_price: shippingCost });
    }

    const preferenceData: any = {
      items: mpItems,
      external_reference: order.id,
      back_urls: {
        success: `${SITE_URL}/payment/success`,
        failure: `${SITE_URL}/payment/failure`,
        pending: `${SITE_URL}/payment/pending`,
      },
      auto_return: 'approved',
      // El webhook vive en el MISMO dominio (api.yesyes.cl está caído).
      notification_url: `${SITE_URL}/api/webhooks/mercadopago`,
    };

    if (payer) {
      const email = String(payer.email || '').trim();
      const payerData: any = {
        ...(String(payer.name || '').trim() ? { name: String(payer.name).trim() } : {}),
        ...(String(payer.surname || '').trim() ? { surname: String(payer.surname).trim() } : {}),
        // Solo enviar email si es plausible; un email vacío/invalido rechaza MP.
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

    const preferenceClient = getPreferenceClient();
    const response = await preferenceClient.create({ body: preferenceData });

    res.status(200).json({
      id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
      public_key: getPublicKey(),
      orderId: order.id,
    });
  } catch (error: any) {
    // Detalle completo en el log del servidor y detalle breve al cliente
    // para que un fallo de MP no sea un misterioso "Error al procesar el pago".
    console.error('Error creating payment preference:', error?.message || error);
    if (error?.error) console.error('Mercado Pago API error:', JSON.stringify(error.error));
    res.status(500).json({
      message: 'Error creating payment preference',
      detail: error?.message || 'Error desconocido',
    });
  }
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
