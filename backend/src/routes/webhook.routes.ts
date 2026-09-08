import { Router } from 'express';
import { validateWebhook } from '../controllers/payment.controller';
import { updateOrderStatus, updateOrderPayment } from '../services/order.service';
import { prisma } from '../lib/prisma';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const router = Router();

/**
 * Webhook de Mercado Pago.
 *
 * IMPORTANTE: el payload del webhook SOLO trae `data.id` (id del pago).
 * NO trae `status` ni `external_reference` (el código anterior los esperaba
 * en el body y por eso ninguna orden pasaba nunca a PAID). Hay que consultar
 * el pago a la API de Mercado Pago con el access token.
 */
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
        const order = await prisma.order.findUnique({
          where: { id: externalReference },
          select: { id: true },
        });

        if (order) {
          await updateOrderPayment(externalReference, String(payment.id));

          if (status === 'approved') {
            await updateOrderStatus(externalReference, 'PAID');
            await prisma.order.update({
              where: { id: externalReference },
              data: { paymentStatus: 'APPROVED' },
            });
          } else if (status === 'rejected') {
            await updateOrderStatus(externalReference, 'CANCELLED');
            await prisma.order.update({
              where: { id: externalReference },
              data: { paymentStatus: 'REJECTED' },
            });
          } else if (status === 'cancelled') {
            await updateOrderStatus(externalReference, 'CANCELLED');
            await prisma.order.update({
              where: { id: externalReference },
              data: { paymentStatus: 'CANCELLED' },
            });
          } else if (status === 'refunded') {
            await prisma.order.update({
              where: { id: externalReference },
              data: { paymentStatus: 'REFUNDED' },
            });
          }

          console.log(`[mp-webhook] Pago ${payment.id} (${status}) → orden ${externalReference} actualizada`);
        } else {
          console.warn(`[mp-webhook] Orden ${externalReference} no encontrada para el pago ${payment.id}`);
        }
      }
    }

    // Siempre 200: devolver error hace que Mercado Pago reintente indefinidamente.
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[mp-webhook] Error procesando webhook:', error?.message || error);
    res.status(200).json({ received: true });
  }
});

export default router;
