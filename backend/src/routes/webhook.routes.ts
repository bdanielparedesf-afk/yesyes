import { Router } from 'express';
import { validateWebhook } from '../controllers/payment.controller';
import { updateOrderStatus } from '../services/order.service';

const router = Router();

router.post('/mercadopago', async (req, res) => {
  if (!validateWebhook(req)) {
    res.status(401).json({ message: 'Invalid webhook signature' });
    return;
  }

  const { action, data, type } = req.body;

  if (type === 'payment' && action === 'payment.updated') {
    const paymentId = data?.id;
    const externalReference = data?.external_reference;

    if (externalReference && paymentId) {
      try {
        const paymentStatus = data?.status;

        if (paymentStatus === 'approved') {
          await updateOrderStatus(externalReference, 'PAID');
          console.log(`Order ${externalReference} marked as PAID`);
        } else if (paymentStatus === 'cancelled' || paymentStatus === 'rejected') {
          await updateOrderStatus(externalReference, 'CANCELLED');
          console.log(`Order ${externalReference} marked as CANCELLED`);
        }
      } catch (error) {
        console.error('Error updating order from webhook:', error);
      }
    }
  }

  res.status(200).json({ received: true });
});

export default router;
