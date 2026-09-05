import { Router } from 'express';
import { validateWebhook } from '../controllers/payment.controller';

const router = Router();

router.post('/mercadopago', (req, res) => {
  if (!validateWebhook(req)) {
    res.status(401).json({ message: 'Invalid webhook signature' });
    return;
  }

  const { action, data, type } = req.body;

  if (type === 'payment' && action === 'payment.created') {
    console.log('Payment created:', data);
  }

  if (type === 'payment' && action === 'payment.updated') {
    console.log('Payment updated:', data);
  }

  res.status(200).json({ received: true });
});

export default router;
