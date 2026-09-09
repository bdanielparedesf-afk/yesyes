import { Router } from 'express';
import { importCJProduct, previewCJProduct, listRecentProducts, deleteProduct } from '../controllers/cj.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// Todas las rutas de importación son administrativas: requieren sesión de admin.
// NOTA: el auth va por-ruta (no con router.use global) para que al montar
// varios routers bajo el mismo prefijo '/admin' Express pueda seguir
// buscando en el siguiente router cuando la ruta no matchea aquí.
router.post('/import-cj', authenticate, requireAdmin, importCJProduct);
router.post('/preview-cj', authenticate, requireAdmin, previewCJProduct);
router.get('/recent-products', authenticate, requireAdmin, listRecentProducts);
router.delete('/products/:id', authenticate, requireAdmin, deleteProduct);

export default router;
