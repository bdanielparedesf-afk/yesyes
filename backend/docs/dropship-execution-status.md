# Estado DS — 2026-09-16

Este informe corresponde a esta ejecución; no declara completa la integración.

## Cambios

- Cliente existente conectado a los tipos y constructor de requests de `src/lib/aliexpress/`; eliminada la duplicación de firma en el cliente.
- Se conserva HMAC-SHA256 de parámetros ordenados sin prefijo OAuth, gateway /sync y token en session. No se cambió OAuth. No se certifica el algoritmo contra un contrato oficial DS recuperado en esta ejecución.
- Búsqueda devuelve productos tipados con IDs string. Detalle exige identidad coincidente y valida SKU, precios y campos disponibles de descripción, imágenes, atributos y tienda. Stock ausente permanece ausente.
- Timeout 15 segundos, sin redirects ni reintentos automáticos; errores sanitizados con códigos permitidos, sin mensajes de proveedor.
- Probe de solo lectura encadena búsqueda → primer ID devuelto → detalle. Admite token privado de entorno o recuperación del almacenamiento cifrado. No necesita un ID preconfigurado.
- Script antiguo con credenciales reemplazado sin ejecutarlo. Las credenciales expuestas deben rotarse; borrarlas del archivo no revoca su acceso ni borra copias previas.

## Resultado por método

| Método | Código | Prueba real |
|---|---|---|
| aliexpress.ds.text.search | Cliente tipado implementado sobre los esquemas existentes; compatibilidad remota no certificada | BLOCKED antes de enviar request |
| aliexpress.ds.product.get | Cliente tipado implementado sobre los esquemas existentes; compatibilidad remota no certificada | BLOCKED antes de enviar request |
| aliexpress.ds.product.wholesale.get | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.ds.freight.query | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.logistics.buyer.freight.calculate | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.ds.image.searchV2 | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.ds.category.tree.get | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.ds.category.get | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.ds.feed.itemids.get | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.ds.order.create | No implementado: no se localizó contrato de parámetros/respuesta | Prohibida por alcance de solo lectura |
| aliexpress.trade.ds.order.get | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |
| aliexpress.ds.order.tracking.get | No implementado: no se localizó contrato de parámetros/respuesta | No ejecutada |

El catálogo local `aliexpress-api-catalog.md` corresponde a APIs de vendedor. Las páginas públicas consultadas devolvieron loading o documentación OAuth, no los contratos DS solicitados. No se afirma que el administrador nunca los haya proporcionado: no se localizaron en los archivos revisados ni en el contexto accesible de esta ejecución. Los esquemas existentes no sustituyen evidencia oficial.

## Configuración y prueba

Probe ejecutado: `node D:\proyectosweb\YesYes\backend\scripts\aliexpress-dropship-probe.cjs`.
Resultado: salida 2, MISSING_PRIVATE_CONFIGURATION, requestAttempted=false.
Faltan ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, ALIEXPRESS_TOKEN_ENCRYPTION_KEY y ALIEXPRESS_PROBE_ACCOUNT para la vía cifrada. Tampoco está presente ALIEXPRESS_ACCESS_TOKEN como alternativa. DATABASE_URL sí está configurada. No se imprimieron valores de entorno ni se usaron las credenciales incrustadas.

Configurar únicamente en el entorno privado backend. No enviar secretos al chat. No se realizó refresh ni canje OAuth ni escritura de productos u órdenes.

## Validación

- Suite backend: 65 tests, 64 aprobados, 0 fallidos, 1 omitido (integración Supabase con opt-in ALIEXPRESS_DB_TEST; realiza escrituras transaccionales con rollback y no fue habilitada).
- TypeScript backend y build backend: aprobados.
- Build frontend: aprobado; advertencia de chunk mayor a 500 kB.
- Prisma validate: aprobado; no se aplicaron migraciones ni cambios de esquema en esta ejecución.
- Tests de entorno, cifrado, errores y rutas: aprobados; no equivalen a auditoría completa del historial ni a certificación de seguridad.
- Git diff --check: aprobado.
- Git diff de archivos CJ: vacío, salida 0. No se realizó regresión funcional remota de CJ.
- Fixtures DS sintéticos: prueban el código local, NO una respuesta de AliExpress.

## Lo que falta para declarar funcionalidad

Obtener evidencia del contrato DS aplicable (firma y esquemas), configurar credenciales rotadas en entorno privado y conseguir respuestas reales válidas de búsqueda y detalle. Implementar y validar los otros diez métodos con sus contratos. No declarar completa la integración mientras falten estos pasos.
