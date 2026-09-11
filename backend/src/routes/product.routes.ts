import { Router } from 'express';
import { getProducts, getCollections, getProductBySlug, updateProduct, bulkDeleteProducts } from '../controllers/product.controller';
import { authenticate as authMiddleware, requireAdmin as adminMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/', getProducts);
router.get('/groups', getCollections);
router.delete('/bulk-delete', authMiddleware, adminMiddleware, bulkDeleteProducts);
router.get('/:id', getProductBySlug);
router.put('/:id', updateProduct);

export default router;
