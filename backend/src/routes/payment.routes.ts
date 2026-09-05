import { Router } from 'express';
import { createPaymentPreference, getPaymentStatus, getPaymentMethods } from '../controllers/payment.controller';

const router = Router();

router.post('/create-preference', createPaymentPreference);
router.get('/payment-methods', getPaymentMethods);
router.get('/status/:paymentId', getPaymentStatus);

export default router;
