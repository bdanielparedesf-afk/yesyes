/**
 * Backwards-compatible barrel for the AliExpress Dropship types.
 * Catalog schemas now live in ./dropship-catalog-types, taxonomy in
 * ./dropship-taxonomy-types, orders in ./dropship-order-types and the shared
 * primitives in ./dropship-common. Kept so existing imports keep working.
 */
export * from './dropship-common';
export * from './dropship-catalog-types';
export * from './dropship-taxonomy-types';
export * from './dropship-order-types';
