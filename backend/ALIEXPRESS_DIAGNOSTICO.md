# ALIEXPRESS YESYES — diagnóstico fases 1–5

## Resultado

Integración detenida antes de implementar transporte, firma o importación. No hubo solicitud autenticada a AliExpress. No hay evidencia de credenciales rechazadas ni permisos denegados: ambos siguen SIN VERIFICAR.

La plantilla backend incluye ALIEXPRESS_APP_KEY y ALIEXPRESS_APP_SECRET vacíos. Se conservaron API_KEY/API_SECRET por compatibilidad con las pruebas existentes; no hay alias implementado. El .env local no fue modificado. Preflight: MISSING_CREDENTIALS. Rotar el secreto compartido e introducirlo exclusivamente en el entorno privado backend. Rotar también las credenciales afectadas por la lectura anterior del .env en la salida de herramientas.

## Auditoría

Raíz: D:\proyectosweb\YesYes.

- Backend Express/TypeScript; dotenv: D:\proyectosweb\YesYes\backend\src\config\env.ts.
- Auth JWT y cookies Auth.js; authenticate + requireAdmin: D:\proyectosweb\YesYes\backend\src\middlewares\auth.ts.
- Prisma PostgreSQL: D:\proyectosweb\YesYes\backend\prisma\schema.prisma. Sin cambios ni migraciones.
- Product ya tiene aliexpressId, aliexpressUrl, supplierProductId, supplierUrl, sourcePlatform, sourceId, sourceUrl, costos, márgenes y DRAFT.
- ProductVariant reutilizable; faltan campos dedicados para ID proveedor, atributos generales, imagen y costo/moneda original. Stock entero por defecto cero no representa desconocido.
- ProductImage ya tiene url, alt, position. Supplier y PriceRule existen.
- ProductSupplier incluye ALIEXPRESS, no CJ: identificar CJ mediante sourcePlatform, no solo el enum.
- Category tiene parentId; no crear categorías paralelas.
- CJ: D:\proyectosweb\YesYes\backend\src\lib\cj.ts y controladores cj, scrape, excel existentes. Sin cambios.
- getCJFreight está en lib CJ. getDollarRate está en D:\proyectosweb\YesYes\backend\src\controllers\cj.controller.ts: fuentes externas con respaldo fijo 950. No reutilizar silenciosamente ese respaldo.
- D:\proyectosweb\YesYes\backend\src\jobs\priceSync.ts filtra CJ y actualiza costos/alertas sin escribir salePrice. No ejecutado por sus escrituras reales.
- Traducción reutilizable: D:\proyectosweb\YesYes\backend\src\lib\translator.ts y D:\proyectosweb\YesYes\backend\src\lib\translate.ts. AI/MyMemory con control de fallos necesario.
- Clasificación por heurísticas en lib CJ, sin confianza explícita.
- AuditLog.metadata y Product.hasAlert/alert/alertLevel reutilizables.
- D:\proyectosweb\YesYes\backend\src\services\order.service.ts crea OrderItem sin snapshot completo del proveedor.
- D:\proyectosweb\YesYes\frontend\src\App.tsx: admin existente; /admin/import-aliexpress redirige a CJ, no constituye integración AliExpress.

## Evidencia oficial y bloqueo

Fuentes consultadas:
- https://openservice.aliexpress.com/doc/doc.htm
- https://open.aliexpress.com/doc/doc.htm
- Renderizado: https://r.jina.ai/https://openservice.aliexpress.com/doc/doc.htm

Las páginas directas devolvieron loading. El renderizado mostró un catálogo de vendedor y describió OAuth 2.0, /auth/token/create y /auth/token/refresh. Eso NO valida el contrato dropshipping aplicable a esta aplicación.

Sin confirmar: gateway aplicable, firma, versión, parámetros, respuesta de negocio, errores, scopes, cuota, sandbox y permisos concedidos. No se afirma que una URL propuesta sea sandbox. No se implementó OAuth a partir de rutas incompletas.

| Función | Estado | API/permiso requerido | Acción administrativa |
|---|---|---|---|
| Autenticación/firma | BLOQUEADO | Contrato aplicable sin confirmar | Obtener documentación/SDK oficial de la consola de la aplicación |
| Producto/precio/variantes/SKU/imágenes/stock | BLOQUEADO | Método de lectura y permisos sin confirmar | Revisar tipo de app y APIs aprobadas; aportar enlaces/exportación sin secretos |
| Envío Chile | BLOQUEADO | Método logístico CL por variante sin confirmar | Confirmar API/permiso disponible; no asumir envío gratis |
| OAuth | BLOQUEADO | Requisito exacto para esta app sin confirmar | Confirmar cuenta autorizante, callback y flujo oficial; autorizar si corresponde |

AppKey + AppSecret no prueban acceso. No se enviaron secretos a lectores web ni se crearon endpoints hipotéticos o scraping.

## Validación

Ejecutar: node D:\proyectosweb\YesYes\backend\scripts\aliexpress-preflight.cjs

Carga .env backend y entorno del proceso. Imprime un DTO fijo sin credenciales. Es LOCAL, NO prueba de API. Código de salida 2 por bloqueo. False significa no verificado, no rechazo remoto.

- 9 tests node:test aprobados (entorno/preflight).
- Backend typecheck y build aprobados.
- Frontend build aprobado; advertencia de chunk >500 kB.
- .env privados no trackeados y gitignore comprobado por tests.
- No se certificó ausencia de secretos en todo el historial Git, logs o artefactos previos.
- Regresión funcional login/productos/carrito/checkout/Mercado Pago/pedidos/admin/CJ: PENDIENTE. Build no basta.

## Estado solicitado

| Elemento | Estado |
|---|---|
| Credenciales configuradas | PENDIENTE: rotación/configuración privada |
| Autenticación / API autorizada | BLOQUEADO: contrato/permisos sin verificar |
| Producto por URL / Variantes / SKU / Imágenes / Stock / Precio / Envío Chile | BLOQUEADO: APIs/permisos sin verificar |
| Costo total / Margen 50–400% / Traducción / Categorías | PENDIENTE: fases posteriores |
| Preview / Publicación / Sincronización / Historial / Alertas | PENDIENTE: fases posteriores |
| Order snapshot / Duplicados / Administración | PENDIENTE: fases posteriores |
| Tests | COMPLETADO preflight/entorno; PENDIENTE API real |
| Build | COMPLETADO backend/frontend |
| Regresión CJ | PENDIENTE funcional; código sin cambios |
