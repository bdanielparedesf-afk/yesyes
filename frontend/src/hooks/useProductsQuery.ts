import { useQuery } from '@tanstack/react-query';
import {
  getProducts,
  getProductBySlug,
  getProductsByCategory,
  getHomeData,
  getCategories,
} from '@/services/products';

/**
 * Hooks de React Query para los servicios de productos.
 *
 * Estos hooks envuelven las funciones existentes de services/products.ts
 * sin duplicar la lógica de API. Aportan:
 *  - Caching automática entre navegaciones
 *  - Background refetch en window-focus (precios/stock frescos)
 *  - Estados de loading/error consistentes
 *  - keepPreviousData para transiciones sin pantallas blancas
 *
 * Los keys de query están namespaced por entidad para evitar colisiones.
 */

/** Parámetros de la lista de productos. */
export interface ProductsParams {
  search?: string;
  category?: string;
  collection?: string;
  limit?: number;
  offset?: number;
}

// ---------- Query keys ----------
export const QUERY_KEYS = {
  products: 'products',
  product: 'product',
  categoryProducts: 'category-products',
  home: 'home',
  categories: 'categories',
} as const;

// ---------- Hooks ----------

/**
 * Lista de productos (pública). Soporta search, category, collection, limit, offset.
 * keepPreviousData mantiene los productos anteriores visiblemente mientras
 * llega una nueva página o filtro.
 */
export function useProducts(
  params?: ProductsParams,
  options?: Parameters<typeof useQuery>[1],
) {
  const queryKey = [QUERY_KEYS.products, params ?? {}];
  return useQuery({
    queryKey,
    queryFn: () => getProducts(params),
    // Mantener datos anteriores durante cambios de filtro/página
    placeholderData: (prev: any) => prev,
    ...options,
  });
}

/**
 * Detalle de un producto por slug. El slug es el key, por lo que al navegar
 * entre productos distintos se refetch y al volver se muestra el caché.
 */
export function useProductBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.product, slug],
    queryFn: () => (slug ? getProductBySlug(slug) : Promise.resolve(null)),
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
}

/**
 * Productos de una categoría. keepPreviousData evita pantallas blancas
 * al cambiar de categoría o al reordenar.
 */
export function useProductsByCategory(
  slug: string | undefined,
  options?: Parameters<typeof useQuery>[1],
) {
  const queryKey = [QUERY_KEYS.categoryProducts, slug];
  return useQuery({
    queryKey,
    queryFn: () => (slug ? getProductsByCategory(slug) : Promise.resolve({ category: null, products: [], total: 0 })),
    enabled: Boolean(slug),
    placeholderData: (prev: any) => prev,
    ...options,
  });
}

/**
 * Datos de la home page. El Home actual solo renderiza categorías + "Lo último",
 * por eso usa `lite=true`: el backend omite Destacados/Ofertas/por-categoría
 * (ahorra ~5 consultas pesadas a Supabase). Sin el flag, respuesta completa
 * (compatibilidad con otros consumidores).
 * El backend ya tiene caché de 5min; el frontend complementa con staleTime.
 * Home usa 5min de staleTime porque el contenido cambia poco en breve período
 * y la caché reduce requests innecesarios.
 */
export function useHomeData(options?: Parameters<typeof useQuery>[1]) {
  return useQuery({
    queryKey: [QUERY_KEYS.home, 'lite'],
    queryFn: () => getHomeData(true),
    staleTime: 5 * 60_000, // 5 minutos: el contenido del Home cambia poco
    gcTime: 10 * 60_000, // 10 minutos: volver al Home muestra caché al instante
    refetchOnWindowFocus: false, // no bloquear con refetch al volver a la pestaña
    placeholderData: (prev: any) => prev, // nunca pantalla blanca si hay caché
    ...options,
  });
}

/**
 * Lista de categorías activas (usada en el header y filtros del catálogo).
 * */
export function useCategories(options?: Parameters<typeof useQuery>[1]) {
  return useQuery({
    queryKey: [QUERY_KEYS.categories],
    queryFn: () => getCategories(),
    staleTime: 5 * 60_000, // 5 minutos: las categorías cambian rara vez
    ...options,
  });
}
