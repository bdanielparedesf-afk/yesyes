/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 (Fase 3).
 *
 * Barril único del motor. Los registries son la fuente de verdad y se
 * importan desde acá, tanto en rutas como en tests.
 *
 * Estructura:
 *   block-registry     → QUÉ se puede componer (bloques)
 *   layout-registry    → CÓMO se compone (layouts)
 *   capabilities       → PARA QUIÉN (rubro)
 *   template-manifest  → CONTRATO versionado y validado
 *   site-instance      → MASTER TEMPLATE vs SITIO DEL NEGOCIO
 *   render-plan        → el plan que alimenta al renderer ÚNICO
 *
 * El motor no renderiza. `frontend/src/business/BusinessPageRenderer` sigue
 * siendo el único renderer del sistema.
 */

export * from './block-registry';
export * from './layout-registry';
export * from './variant-registry';
export * from './design-registry';
export * from './capabilities';
export * from './template-manifest';
export * from './site-instance';
export * from './render-plan';
export * from './media-ref';
