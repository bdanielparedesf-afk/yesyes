import { Router } from 'express';
import { getProducts, getCollections, getProductBySlug, updateProduct } from '../controllers/product.controller';

const router = Router();

router.get('/', getProducts);
router.get('/groups', getCollections);
router.get('/:id', getProductBySlug);
router.put('/:id', updateProduct);

export default router;
