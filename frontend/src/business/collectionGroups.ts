/**
 * YESYES BUSINESS — GRUPOS DE CONTENIDO INDEPENDIENTES (fix §13).
 *
 * Productos y servicios (y propiedades) son RECURSOS DISTINTOS del negocio:
 * pueden existir al mismo tiempo y deben poder mostrarse al mismo tiempo.
 *
 * El bug: `properties.length ? properties : products.length ? products : services`
 * convertía tres recursos en una lista única, así que un negocio con 6 servicios
 * y 4 productos terminaba mostrando 4 productos y 0 servicios. Invertir el orden
 * del ternario solo invierte el bug: la regla es que NO se mezclen.
 *
 * Aquí se resuelve la pregunta correcta: ¿qué grupos tienen contenido y deben
 * renderizarse? Cada grupo se decide por separado.
 */

export type CollectionKey = 'properties' | 'products' | 'services';

export interface CollectionInput {
  properties?: any[] | null;
  products?: any[] | null;
  services?: any[] | null;
}

export interface CollectionGroup {
  key: CollectionKey;
  label: string;
  items: any[];
}

export interface CollectionGroups {
  properties: any[];
  products: any[];
  services: any[];
  /** Grupos con contenido, en el orden en que deben mostrarse. */
  visible: CollectionGroup[];
}

const LABELS: Record<CollectionKey, string> = {
  properties: 'Propiedades destacadas',
  products: 'Productos',
  services: 'Servicios',
};

/** Orden estable: propiedades, productos y servicios conviven sin mezclarse. */
const ORDER: CollectionKey[] = ['properties', 'products', 'services'];

const list = (value: any[] | null | undefined): any[] => (Array.isArray(value) ? value : []);

/**
 * Calcula los grupos a mostrar. Cada recurso se evalúa por separado: tener
 * productos NUNCA elimina los servicios, y viceversa.
 */
export function resolveCollectionGroups(input: CollectionInput): CollectionGroups {
  const properties = list(input.properties);
  const products = list(input.products);
  const services = list(input.services);
  const visible: CollectionGroup[] = [];
  for (const key of ORDER) {
    const items = key === 'properties' ? properties : key === 'products' ? products : services;
    if (items.length) visible.push({ key, label: LABELS[key], items });
  }
  return { properties, products, services, visible };
}

/** Etiqueta legible de un grupo (misma fuente que usa la vista). */
export function collectionGroupLabel(key: CollectionKey): string {
  return LABELS[key];
}
