/**
 * Motor de variantes (agnostico de proveedor: AliExpress, CJ, Temu, Amazon,
 * productos manuales). Trabaja solo con datos ya normalizados y NO depende de
 * precios ni de logica de negocio: recibe las variantes y expone atributos,
 * combinaciones, disponibilidad y seleccion.
 *
 * Todo se precalcula una sola vez (Map/indices) para que la UI no recorra
 * todas las combinaciones en cada render.
 */
import {
  groupAttributes,
  presentAttributeName,
  presentAttributeValue,
  type CleanAttribute,
  type NormalizedVariant,
} from './aliexpressVariants';

export type VariantAvailability = 'available' | 'out_of_stock' | 'unavailable';

export interface VariantCombination {
  id: string;
  sku: string;
  supplierVariantId?: string;
  /** Precio de venta final (CLP) de la combinacion. */
  price: number;
  stock: number;
  image?: string;
  attributes: CleanAttribute[];
  attributeMap: Record<string, string>;
  supplierCost?: number | null;
  supplierShipping?: number | null;
  normalized: NormalizedVariant;
}

export interface VariantOptionVM {
  value: string;
  availability: VariantAvailability;
  image?: string;
}

export interface VariantAttributeVM {
  name: string;
  presentation: 'image' | 'text';
  options: VariantOptionVM[];
}

export interface VariantEngine<P = unknown> {
  /** El producto tiene 2+ combinaciones con atributos comerciales. */
  hasVariants: boolean;
  /** Hay variantes pero no se pudieron leer atributos: mostrar aviso amigable. */
  invalid: boolean;
  attributes: VariantAttributeVM[];
  combinations: VariantCombination[];
  /** Combinacion unica (producto simple o con una sola variante util). */
  first: VariantCombination | null;
  totalStock: number;
  priceRange: { min: number; max: number } | null;
  /** Variante original (fila de DB, JSON del proveedor, etc.). */
  sourceOf: (combination: VariantCombination | null) => P | undefined;
  defaultSelection: () => Record<string, string>;
  find: (selection: Record<string, string>) => VariantCombination | null;
  availabilityOf: (
    attribute: string,
    value: string,
    selection: Record<string, string>,
  ) => VariantAvailability;
  /** Ajusta la seleccion para que nunca quede en una combinacion inexistente. */
  reconcile: (
    selection: Record<string, string>,
    changedAttribute: string,
  ) => Record<string, string>;
  describe: (selection: Record<string, string>) => CleanAttribute[];
}

function combinationKey(map: Record<string, string>, groupNames: string[]): string {
  return groupNames.map((name) => `${name}=${map[name] ?? ''}`).join('|');
}

export function buildVariantEngine<P>(
  sources: P[],
  toNormalized: (source: P) => NormalizedVariant,
): VariantEngine<P> {
  const list: P[] = Array.isArray(sources) ? sources : [];
  const combinations: VariantCombination[] = [];
  const sourcesByKey = new Map<string, P>();
  const indexByKey = new Map<string, number>();
  const pending: { key: string; combination: VariantCombination; source: P }[] = [];

  list.forEach((source, index) => {
    let normalized: NormalizedVariant;
    try {
      normalized = toNormalized(source);
    } catch {
      return;
    }
    const attributes = (Array.isArray(normalized?.attributes) ? normalized.attributes : [])
      .map((a) => ({
        name: presentAttributeName(a?.name, a?.value),
        value: presentAttributeValue(a?.name, a?.value),
      }))
      .filter((a) => a.name && a.value);
    if (!attributes.length) return;
    // Presentacion consistente: attributeMap, grupos y seleccion usan el mismo
    // valor presentado; la resolucion real sigue por id/sku/supplierVariantId.
    normalized.attributes = attributes;
    const attributeMap: Record<string, string> = {};
    attributes.forEach((a) => {
      if (a?.name && !(a.name in attributeMap)) attributeMap[a.name] = a.value;
    });
    const key = Object.keys(attributeMap).sort()
      .map((name) => `${name}=${attributeMap[name]}`).join('|');
    pending.push({
      key,
      source,
      combination: {
        id: normalized.id || `v-${index}`,
        sku: normalized.sku ?? '',
        supplierVariantId: normalized.supplierVariantId,
        price: Number(normalized.price) || 0,
        stock: Number(normalized.stock) || 0,
        image: normalized.image || undefined,
        attributes,
        attributeMap,
        supplierCost: normalized.supplierCost ?? null,
        supplierShipping: normalized.supplierShipping ?? null,
        normalized,
      },
    });
  });

  // Misma combinacion repetida (dos SKUs con iguales atributos): conserva la que tenga stock.
  pending.forEach(({ key, combination, source }) => {
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, combinations.length);
      combinations.push(combination);
      sourcesByKey.set(key, source);
      return;
    }
    const current = combinations[existingIndex];
    if (current && combination.stock > current.stock) {
      combinations[existingIndex] = combination;
      sourcesByKey.set(key, source);
    }
  });

  const groups = groupAttributes(combinations.map((c) => c.normalized));
  const groupNames = groups.map((g) => g.name);

  const byKey = new Map<string, VariantCombination>();
  const byValue = new Map<string, Map<string, VariantCombination[]>>();
  combinations.forEach((combination) => {
    byKey.set(combinationKey(combination.attributeMap, groupNames), combination);
    groupNames.forEach((name) => {
      const value = combination.attributeMap[name];
      if (!value) return;
      let values = byValue.get(name);
      if (!values) { values = new Map(); byValue.set(name, values); }
      const bucket = values.get(value);
      if (bucket) bucket.push(combination);
      else values.set(value, [combination]);
    });
  });

  const availabilityOf = (
    attribute: string,
    value: string,
    selection: Record<string, string>,
  ): VariantAvailability => {
    const candidates = byValue.get(attribute)?.get(value) ?? [];
    if (!candidates.length) return 'unavailable';
    const others = groupNames
      .filter((name) => name !== attribute && selection?.[name])
      .map((name) => [name, selection[name] as string] as const);
    const consistent = candidates.filter((c) =>
      others.every(([name, val]) => c.attributeMap[name] === val));
    if (!consistent.length) return 'unavailable';
    return consistent.some((c) => c.stock > 0) ? 'available' : 'out_of_stock';
  };

  const attributes: VariantAttributeVM[] = groups.map((group) => {
    const options: VariantOptionVM[] = group.options.map((value) => {
      const pool = byValue.get(group.name)?.get(value) ?? [];
      const image = pool.find((c) => c.image)?.image;
      return {
        value,
        // Informativo: la disponibilidad real depende de la seleccion actual.
        availability: pool.some((c) => c.stock > 0) ? 'available' : 'out_of_stock',
        ...(image ? { image } : {}),
      };
    });
    return {
      name: group.name,
      presentation: options.some((o) => o.image) ? 'image' : 'text',
      options,
    };
  });

  const find = (selection: Record<string, string>): VariantCombination | null => {
    const entries = Object.entries(selection ?? {})
      .filter(([name, value]) => Boolean(value) && groupNames.includes(name));
    if (!entries.length) return null;
    const exact = byKey.get(combinationKey(selection, groupNames));
    if (exact) return exact;
    const matches = combinations.filter((c) =>
      entries.every(([name, value]) => c.attributeMap[name] === value));
    if (!matches.length) return null;
    return matches.find((c) => c.stock > 0) ?? matches[0] ?? null;
  };

  const defaultSelection = (): Record<string, string> => {
    const best = combinations.find((c) => c.stock > 0) ?? combinations[0];
    if (!best) return {};
    const selection: Record<string, string> = {};
    groupNames.forEach((name) => {
      const value = best.attributeMap[name];
      if (value) selection[name] = value;
    });
    return selection;
  };

  const reconcile = (
    selection: Record<string, string>,
    changedAttribute: string,
  ): Record<string, string> => {
    const next: Record<string, string> = { ...(selection ?? {}) };
    const changedValue = next[changedAttribute];
    const pool = changedValue
      ? byValue.get(changedAttribute)?.get(changedValue) ?? []
      : combinations;
    groupNames.forEach((name) => {
      if (name === changedAttribute) return;
      const current = next[name];
      if (!current) return;
      if (availabilityOf(name, current, next) === 'available') return;
      const candidates = new Set<string>();
      pool.forEach((c) => {
        if (c.stock <= 0) return;
        const candidate = c.attributeMap[name];
        if (!candidate) return;
        const compatible = groupNames.every((other) =>
          other === name || !next[other] || c.attributeMap[other] === next[other]);
        if (compatible) candidates.add(candidate);
      });
      const fallback = candidates.values().next().value;
      if (fallback) next[name] = fallback;
    });
    return next;
  };

  const describe = (selection: Record<string, string>): CleanAttribute[] => {
    const out: CleanAttribute[] = [];
    groupNames.forEach((name) => {
      const value = selection?.[name];
      if (value) out.push({ name, value });
    });
    return out;
  };

  const prices = combinations.map((c) => c.price).filter((p) => p > 0);

  return {
    hasVariants: combinations.length > 1 && groupNames.length > 0,
    invalid: list.length > 1 && combinations.length === 0,
    attributes,
    combinations,
    first: combinations[0] ?? null,
    totalStock: combinations.reduce((acc, c) => acc + (c.stock > 0 ? c.stock : 0), 0),
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    sourceOf: (combination) => {
      if (!combination) return undefined;
      return sourcesByKey.get(combinationKey(combination.attributeMap, groupNames));
    },
    defaultSelection,
    find,
    availabilityOf,
    reconcile,
    describe,
  };
}

