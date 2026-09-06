import { Router } from 'express';
import { importCJProduct, previewCJProduct, listRecentProducts, deleteProduct } from '../controllers/cj.controller';

const router = Router();

router.post('/import-cj', importCJProduct);
router.post('/preview-cj', previewCJProduct);
router.get('/recent-products', listRecentProducts);
router.delete('/products/:id', deleteProduct);

export default router;
