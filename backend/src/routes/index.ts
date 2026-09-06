import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import webhookRoutes from './webhook.routes';
import reviewRoutes from './review.routes';
import returnRoutes from './return.routes';
import appealRoutes from './appeal.routes';
import couponRoutes from './coupon.routes';
import wishlistRoutes from './wishlist.routes';
import supportRoutes from './support.routes';
import adminRoutes from './admin.routes';
import cjRoutes from './cj.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/reviews', reviewRoutes);
router.use('/returns', returnRoutes);
router.use('/appeals', appealRoutes);
router.use('/coupons', couponRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/support', supportRoutes);
router.use('/admin', adminRoutes);
router.use('/admin', cjRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'yesyes-backend' });
});

export default router;
