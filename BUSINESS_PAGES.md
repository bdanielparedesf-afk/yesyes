# YESYES Business Pages

## Alcance

Business Pages es el constructor de páginas públicas para negocios. Comparte frontend Vite + React, backend Express + Prisma y la API pública agregada, pero permanece aislado del catálogo Store: usa `BusinessCatalogItem`, `Service`, `Property`, `GalleryItem` y suscripciones propias; no usa `Product`, carrito, checkout, órdenes ni inventario de la tienda.

## Arquitectura

- `frontend/src/business/BusinessPageRenderer.tsx`: renderer único para preview y publicación.
- `frontend/src/business/registry.tsx`: resolución de templates legacy y nuevos.
- `frontend/src/business/IndustryTemplates.tsx`: composiciones por rubro para catálogo, industria e identidad visual.
- `frontend/src/business/categoryRegistry.ts`: capacidades, CTA y orden permitido.
- `frontend/src/business/visual/`: presets, fondos, tipografías, spacing, effects, sombras y templates.
- `frontend/src/business/dashboard/`: editor agrupado en Información, Diseño, Contenido, Reservas, Leads y Configuración.
- `backend/src/routes/public-business.routes.ts`: payload público agregado en `GET /api/public/businesses/:slug/page`.
- `backend/src/routes/business.routes.ts`: endpoints protegidos del panel.
- `backend/src/services/business-publish.service.ts`: publicación, preview y estado público.

## Flujo

Crear → seleccionar rubro → elegir plantilla → completar información → personalizar → previsualizar → suscribirse → publicar → editar → republicar. El preview reutiliza exactamente `BusinessPageRenderer`; solo añade una marca discreta de «Vista previa».

## Templates e identidad

Los templates existentes conservan la identidad visual de legacy. Las nuevas composiciones usan fotografía, hero contextual, CTA en español, composición editorial y capacidades específicas por rubro. Los 14 fixtures QA cubren Floristería, Barbería, Peluquería, Cafetería, Restaurante, Pastelería, Uñas, Mascotas, Gimnasio, Automotriz, Inmobiliaria, Boutique, Fotografía y Servicios Profesionales. Assets temáticos son referencias visuales de demo; una publicación usa primero la imagen configurada por el negocio.

## Etiquetas y español

Los códigos técnicos (`HERO`, `SERVICES`, `PUBLISHED`) permanecen en contratos internos. La capa visible traduce categorías, estados, botones, estados vacíos, navegación, errores y CTA a español mediante `businessLabels.ts` y los labels del dashboard.

## Datos y publicación

No se inventan dirección, teléfono, horarios, precios, propiedades o testimonios. Los datos de negocio se cargan desde la API y los datos ficticios se limitan a fixtures. La publicación conserva permisos existentes, estado de suscripción, URL pública y ciclo de edición.

## Visual y responsive

Los tokens se calculan en `visualTokens.ts`; las opciones de fondo, presets y tipografía son compatibles con la composición seleccionada. Los templates usan imágenes con alt, `loading`, proporciones y fallback. QA visual requerido: 390 px, 768 px y 1280 px. Las capturas se guardan bajo `qa/business-captures/`.

## Validación y operación

Desde `frontend`: `npm run build`, `npx tsc --noEmit`, `npm test`. Desde `backend`: `npm run typecheck`, `npm test`, `npm run build`, `npx prisma validate`, `npx prisma migrate status`. La migración `20260924190000_business_categories_2026` es aditiva y solo debe desplegarse en un entorno autorizado.

## No regresión

No modificar Auth.js, Mercado Pago, OAuth, AliExpress, CJ, `priceSync`, carrito, checkout, órdenes, `Product` ni `ProductImage` como parte de este módulo. Los cambios Business deben conservar esos límites y sus permisos.
