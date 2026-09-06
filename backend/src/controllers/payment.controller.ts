import { Request, Response } from 'express';
import { getPreferenceClient, getPublicKey } from '../integrations/mercadopago';
import { MercadoPagoConfig, Payment, PaymentMethod, WebhookSignatureValidator } from 'mercadopago';
import { createOrder } from '../services/order.service';

export const createPaymentPreference = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, payer, total } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'items are required' });
      return;
    }

    const order = await createOrder({
      userId: (req as any).user?.id,
      items: items.map((item: any) => ({
        productId: String(item.id || item.productId),
        productName: String(item.title || item.name || 'Producto'),
        productImage: String(item.image || ''),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.price) || 0,
        totalPrice: (Number(item.price) || 0) * (Number(item.quantity) || 1),
        variant: item.variant || null,
        variantId: item.variantId || null,
      })),
      subtotal: Number(total) || 0,
      shipping: 0,
      discount: 0,
      total: Number(total) || 0,
      shippingAddress: {},
    });

    const mappedItems = items.map((item: any) => ({
      id: String(item.id || item.productId),
      title: String(item.title || 'Producto'),
      description: String(item.description || ''),
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.price) || 0,
      picture_url: String(item.image || ''),
    }));

    const preferenceData: any = {
      items: mappedItems,
      external_reference: order.id,
      back_urls: {
        success: 'https://yesyes.cl/payment/success',
        failure: 'https://yesyes.cl/payment/failure',
        pending: 'https://yesyes.cl/payment/pending',
      },
      auto_return: 'approved',
      notification_url: 'https://api.yesyes.cl/api/webhooks/mercadopago',
    };

    if (payer) {
      preferenceData.payer = {
        name: String(payer.name || ''),
        surname: String(payer.surname || ''),
        email: String(payer.email || ''),
        phone: payer.phone
          ? {
              area_code: String(payer.phone.area_code || ''),
              number: String(payer.phone.number || ''),
            }
          : undefined,
        identification: payer.identification
          ? {
              type: String(payer.identification.type || ''),
              number: String(payer.identification.number || ''),
            }
          : undefined,
      };
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
  } catch (error) {
    console.error('Error creating payment preference:', error);
    res.status(500).json({ message: 'Error creating payment preference' });
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
