// BUSINESS V3 — scopes de separación Tienda vs Negocios.
// Product.businessId NULL = tienda YesYes normal.
// Product.businessId != NULL = catálogo independiente de un negocio.
export const yesYesScope = { businessId: null } as const;

export const businessScope = (businessId: string) => ({ businessId }) as const;

export const isBusinessProduct = (p: { businessId?: string | null } | null | undefined): boolean =>
  !!p && p.businessId != null;

// Filtro obligatorio para jobs de dropshipping (priceSync, sync-engine, CJ, AliExpress).
export const dropshipScope = { businessId: null } as const;
