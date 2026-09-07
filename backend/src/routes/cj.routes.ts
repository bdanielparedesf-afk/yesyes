import { Router } from 'express';
import { importCJProduct, previewCJProduct, listRecentProducts, deleteProduct } from '../controllers/cj.controller';
import { authenticate, requireAdmin, isAdmin } from '../middlewares/auth';

const router = Router();

// Todas las rutas de importación son administrativas: requieren sesión de admin.
router.use(authenticate, requireAdmin, isAdmin);

router.post('/import-cj', importCJProduct);
router.post('/preview-cj', previewCJProduct);
router.get('/recent-products', listRecentProducts);
router.delete('/products/:id', deleteProduct);

export default router;
