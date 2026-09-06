import { Router } from 'express';
import { getProducts, getCollections } from '../controllers/product.controller';

const router = Router();

router.get('/', getProducts);
router.get('/groups', getCollections);

export default router;
