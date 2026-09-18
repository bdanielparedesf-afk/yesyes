const HOST_PATTERN = /^(www|m|[a-z]{2})\.aliexpress\.com$/;

/** Parse only; never fetch supplied URLs, follow redirects or resolve short links. */
export function parseAliExpressUrl(raw: string): { productId: string; skuId?: string; sourceUrl: string } {
  const fail = () => new Error('URL AliExpress inválida. Usa https://www.aliexpress.com/item/ID.html.');
  if (typeof raw !== 'string' || raw.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(raw)) throw fail();
  let url: URL;
  try { url = new URL(raw); } catch { throw fail(); }
  const hostAllowed = url.hostname === 'aliexpress.com' || HOST_PATTERN.test(url.hostname);
  if (!hostAllowed || url.protocol !== 'https:' || url.username || url.password || url.port) throw fail();
  const match = /^\/item\/([1-9]\d{5,24})\.html$/.exec(url.pathname);
  if (!match?.[1]) throw fail();
  // sku_id is detected when present but never replaces the path product_id.
  const rawSku = url.searchParams.get('sku_id') ?? url.searchParams.get('skuId');
  const skuId = rawSku && /^[1-9]\d{1,31}$/.test(rawSku) ? rawSku : undefined;
  const sourceUrl = `https://www.aliexpress.com/item/${match[1]}.html`;
  return skuId ? { productId: match[1], skuId, sourceUrl } : { productId: match[1], sourceUrl };
}

export interface ProductIdentity {
  aliexpressId?: string | null;
  supplierProductId?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  supplierUrl?: string | null;
  aliexpressUrl?: string | null;
  sourcePlatform?: string | null;
  cjProductId?: string | null;
}

/** Legacy CJ rows defaulted to supplier=ALIEXPRESS: never use that enum alone. */
export function matchesAliExpressProduct(product: ProductIdentity, productId: string): boolean {
  if (product.sourcePlatform === 'CJ' || product.cjProductId) return false;
  if (product.aliexpressId === productId) return true;
  const urls = [product.sourceUrl, product.supplierUrl, product.aliexpressUrl];
  const ids = urls.flatMap(url => {
    if (!url) return [];
    try { return [parseAliExpressUrl(url).productId]; } catch { return []; }
  });
  if (ids.includes(productId)) return true;
  return (product.sourcePlatform === 'ALIEXPRESS' || ids.length > 0 || Boolean(product.aliexpressId))
    && (product.supplierProductId === productId || product.sourceId === productId);
}
