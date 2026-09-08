import { Router } from 'express';
import { createPaymentPreference, getPaymentStatus, getPaymentMethods } from '../controllers/payment.controller';
import { optionalAuth } from '../middlewares/auth';

const router = Router();

// optionalAuth: si el cliente manda Bearer token se adjunta req.user (la orden
// queda asociada a su cuenta); si no, se permite guest checkout (Order.userId
// es opcional en el schema).
router.post('/create-preference', optionalAuth, createPaymentPreference);
router.get('/payment-methods', getPaymentMethods);
router.get('/status/:paymentId', getPaymentStatus);

export default router;
