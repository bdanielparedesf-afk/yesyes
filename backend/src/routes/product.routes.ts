import { Router } from 'express';
import { getProducts, getCollections, updateProduct } from '../controllers/product.controller';

const router = Router();

router.get('/', getProducts);
router.get('/groups', getCollections);
router.put('/:id', updateProduct);

export default router;
