import { Router } from 'express';
import { bulkImportCJ, bulkPreviewCJ } from '../controllers/scrape.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// Todas las rutas de scrape son administrativas: requieren sesión de admin.

// POST /api/scrape/cj/bulk  → Importación masiva CJ (hasta 30 links).
// Body: { links: string[], collectionSlug?: string, margin?: number }
// Devuelve una fila OK/Error por link.
router.post('/cj/bulk', authenticate, requireAdmin, bulkImportCJ);

// POST /api/scrape/cj/bulk-preview  → Preview SIN crear productos.
// Body: { links: string[] }
// Reutiliza la lógica de FASE 4A (resolución CJ + traducción + USD->CLP x2)
// y devuelve una fila por link: { link, sourceId, titleEs, costUsd, priceClp,
// images[5], category, status OK/Error, error? }. No crea nada en la BD.
router.post('/cj/bulk-preview', authenticate, requireAdmin, bulkPreviewCJ);

export default router;