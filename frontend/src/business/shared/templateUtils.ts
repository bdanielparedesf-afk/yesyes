/** Datos que recibe cada plantilla de negocio. */
export interface TemplateProps {
  business: any;
  services: any[];
  products: any[];
  properties: any[];
  gallery: any[];
}

export const clp = (n: any): string => `$${Number(n || 0).toLocaleString('es-CL')}`;

/** Primera imagen util de un producto (string[] o {url}[]). */
export const productImage = (p: any): string => {
  const imgs = p?.images;
  if (Array.isArray(imgs) && imgs.length) {
    const first = imgs[0];
    return typeof first === 'string' ? first : first?.url || '';
  }
  return '';
};

export const propertyImage = (p: any): string => p?.images?.[0]?.url || '';

export const propertyHref = (business: any, p: any): string =>
  `/mi-negocio/${business?.slug}/propiedad/${p?.id}`;

/** Filtros combinados de propiedades (buscador, operación, tipo, ciudad, precio, dormitorios). */
export interface PropertyFilterState {
  q: string;
  operation: string;
  type: string;
  city: string;
  maxPrice: string;
  bedrooms: string;
}

export const EMPTY_PROPERTY_FILTER: PropertyFilterState = { q: '', operation: '', type: '', city: '', maxPrice: '', bedrooms: '' };

export function filterProperties(properties: any[], f: Partial<PropertyFilterState>): any[] {
  return (properties || []).filter((p) => {
    if (f.operation && p.operation !== f.operation) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.city && p.city !== f.city) return false;
    if (f.maxPrice && Number(p.price) > Number(f.maxPrice)) return false;
    if (f.bedrooms && Number(p.bedrooms || 0) < Number(f.bedrooms)) return false;
    if (f.q) {
      const hay = `${p.title} ${p.address} ${p.city} ${p.region}`.toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

export const propertyTypes: string[] = ['CASA', 'DEPARTAMENTO', 'TERRENO', 'OFICINA', 'LOCAL', 'PARCELA', 'BODEGA'];

export const operationLabel = (op: string): string => (op === 'VENTA' ? 'Venta' : op === 'ARRIENDO' ? 'Arriendo' : op);

export const waMessage = (business: any, extra?: string): string =>
  `Hola ${business?.name || ''}${extra ? `, ${extra}` : ''}. Vengo desde su página web.`;

