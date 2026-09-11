import { Router } from 'express';
import { getProducts, getCollections, getProductBySlug, updateProduct, bulkDeleteProducts } from '../controllers/product.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

router.get('/', getProducts);
router.get('/groups', getCollections);
// FEATURE A: bulk delete (protegido — igual que el endpoint admin, accesible en /api/products/bulk)
router.delete('/bulk', authenticate, requireAdmin, bulkDeleteProducts);
router.get('/:id', getProductBySlug);
router.put('/:id', updateProduct);

export default router;
