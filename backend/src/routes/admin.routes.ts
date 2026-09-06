import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth';
import { getRecentProducts, deleteProduct } from '../controllers/product.controller';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/recent-products', getRecentProducts);
router.delete('/products/:id', deleteProduct);

export default router;
