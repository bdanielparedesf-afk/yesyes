import { Router } from 'express';
import {
  getProducts, getCollections, getProductBySlug, getHome, getCategoryProducts,
  updateProduct, bulkDeleteProducts,
} from '../controllers/product.controller';
import { authenticate as authMiddleware, requireAdmin as adminMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/', getProducts);
router.get('/groups', getCollections);
router.get('/home', getHome);
router.get('/search', getProducts);
router.get('/category/:slug', getCategoryProducts);
router.delete('/bulk-delete', authMiddleware, adminMiddleware, bulkDeleteProducts);
router.get('/:id', getProductBySlug);
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);

export default router;
