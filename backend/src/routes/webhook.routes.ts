import { Router } from 'express';
import { validateWebhook } from '../controllers/payment.controller';
import { processProviderNotification } from '../services/business-subscription.service';
import { syncPublicationWithSubscription } from '../services/business-publish.service';
import { updateOrderStatus, updateOrderPayment } from '../services/order.service';
import { prisma } from '../lib/prisma';
import { MercadoPagoConfig, Payment, WebhookSignatureValidator } from 'mercadopago';

const router = Router();

/** Mercado Pago Business: suscripciones, separado de pagos de pedidos. */
router.post('/mercadopago/business', async (req, res) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ message: 'Webhook Business no configurado' });
    return;
  }
  const dataId = (req.query.data_id || (req.query as any).id || req.body?.data?.id) as string | undefined;
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers['x-signature'] as string | string[] | undefined | null,
      xRequestId: req.headers['x-request-id'] as string | string[] | undefined | null,
      dataId,
      secret,
      toleranceSeconds: 300,
    });
  } catch {
    res.status(401).json({ message: 'Invalid webhook signature' });
    return;
  }
  try {
    const body = (req.body || {}) as any;
    const type = String(body.type || body.topic || req.query.type || req.query.topic || '');
    const notificationId = String(dataId || '');
    if (!type || !notificationId) {
      res.status(400).json({ message: 'Notificación de Mercado Pago incompleta' });
      return;
    }
    const result = await processProviderNotification({ type, dataId: notificationId, payload: body });
    if (result.handled && !result.duplicate && result.businessId) {
      await syncPublicationWithSubscription(result.businessId, { ip: req.ip });
    }
    res.status(200).json({ received: true, handled: result.handled, duplicate: result.duplicate });
  } catch (error: any) {
    console.error('[mp-business-webhook] Error procesando evento:', error?.message || 'error desconocido');
    res.status(500).json({ message: 'Error procesando evento Business' });
  }
});

/** Webhook existente de pagos de la tienda. */
router.post('/mercadopago', async (req, res) => {
  if (!validateWebhook(req)) {
    res.status(401).json({ message: 'Invalid webhook signature' });
    return;
  }
  try {
    const body = (req.body || {}) as any;
    const type = body.type || body.topic || (req.query.topic as string) || (req.query.type as string);
    const action = String(body.action || '');
    const paymentId = body.data?.id || body.resource || (req.query.data_id as string);
    const isPaymentEvent = type === 'payment' || action.startsWith('payment.');
    if (isPaymentEvent && paymentId) {
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken) {
        console.error('[mp-webhook] MERCADOPAGO_ACCESS_TOKEN no configurado');
        res.status(200).json({ received: true, skipped: 'no-token' });
        return;
      }
      const paymentClient = new Payment(new MercadoPagoConfig({ accessToken }));
      const payment: any = await paymentClient.get({ id: String(paymentId) });
      const status = payment?.status as string | undefined;
      const externalReference = payment?.external_reference as string | undefined;
      if (externalReference) {
        const order = await prisma.order.findUnique({ where: { id: externalReference }, select: { id: true } });
        if (order) {
          await updateOrderPayment(externalReference, String(payment.id));
          if (status === 'approved') {
            await updateOrderStatus(externalReference, 'PAID');
            await prisma.order.update({ where: { id: externalReference }, data: { paymentStatus: 'APPROVED' } });
          } else if (status === 'rejected' || status === 'cancelled') {
            await updateOrderStatus(externalReference, 'CANCELLED');
            await prisma.order.update({ where: { id: externalReference }, data: { paymentStatus: status === 'rejected' ? 'REJECTED' : 'CANCELLED' } });
          } else if (status === 'refunded') {
            await prisma.order.update({ where: { id: externalReference }, data: { paymentStatus: 'REFUNDED' } });
          }
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[mp-webhook] Error procesando webhook:', error?.message || error);
    res.status(200).json({ received: true });
  }
});

export default router;
