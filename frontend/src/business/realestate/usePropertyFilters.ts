import { useMemo, useState } from 'react';

export interface PropertyFilters {
  operation: string;
  type: string;
  city: string;
  bedrooms: string;
  maxPrice: string;
}

/** Filtros de búsqueda de propiedades (operación, tipo, ciudad, dormitorios, precio). */
export function usePropertyFilters(properties: any[]) {
  const [filters, setFilters] = useState<PropertyFilters>({
    operation: '',
    type: '',
    city: '',
    bedrooms: '',
    maxPrice: '',
  });

  const set = (key: keyof PropertyFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const reset = () => setFilters({ operation: '', type: '', city: '', bedrooms: '', maxPrice: '' });

  const cities = useMemo(
    () => Array.from(new Set((properties || []).map((p: any) => p.city).filter(Boolean))) as string[],
    [properties],
  );

  const filtered = useMemo(() => {
    return (properties || []).filter((p: any) => {
      if (filters.operation && p.operation !== filters.operation) return false;
      if (filters.type && p.type !== filters.type) return false;
      if (filters.city && p.city !== filters.city) return false;
      if (filters.bedrooms && Number(p.bedrooms || 0) < Number(filters.bedrooms)) return false;
      if (filters.maxPrice && Number(p.price || 0) > Number(filters.maxPrice)) return false;
      return true;
    });
  }, [properties, filters]);

  return { filters, set, reset, cities, filtered };
}
