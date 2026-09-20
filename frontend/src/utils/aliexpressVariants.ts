/** Presentacion de variantes AliExpress: limpieza + agrupacion. Solo frontend. */
export interface CleanAttribute { name: string; value: string }
export interface NormalizedVariant {
  id: string; sku: string; supplierVariantId?: string;
  price: number; stock: number; image?: string;
  supplierCost?: number | null; supplierShipping?: number | null;
  attributes: CleanAttribute[];
}
export interface AttributeGroup { name: string; options: string[] }
const COLOR_ES: Record<string, string> = {
  black: 'Negro', white: 'Blanco', red: 'Rojo', blue: 'Azul',
  green: 'Verde', pink: 'Rosa', purple: 'Morado', violet: 'Morado',
  gold: 'Dorado', golden: 'Dorado', orange: 'Naranja', yellow: 'Amarillo',
  grey: 'Gris', gray: 'Gris', silver: 'Plateado', brown: 'Café',
  beige: 'Beige', navy: 'Azul marino', sky: 'Celeste', cyan: 'Celeste',
  teal: 'Turquesa', mint: 'Menta', rose: 'Rosa', champagne: 'Champaña',
  bronze: 'Bronce', copper: 'Cobre', khaki: 'Caqui', lilac: 'Lila',
  lavender: 'Lavanda', burgundy: 'Burdeos', wine: 'Burdeos',
  maroon: 'Granate', olive: 'Oliva', coral: 'Coral',
  turquoise: 'Turquesa', transparent: 'Transparente', clear: 'Transparente',
  multicolor: 'Multicolor', multicolour: 'Multicolor',
  // Claves en espanol (los atributos estructurados ya llegan traducidos).
  negro: 'Negro', blanco: 'Blanco', rojo: 'Rojo', verde: 'Verde',
  rosa: 'Rosa', morado: 'Morado', dorado: 'Dorado', naranja: 'Naranja',
  amarillo: 'Amarillo', gris: 'Gris', celeste: 'Celeste', azul: 'Azul',
  plateado: 'Plateado', turquesa: 'Turquesa', lila: 'Lila',
  cafe: 'Café', vino: 'Burdeos',
  'azul cielo': 'Celeste', 'azul oscuro': 'Azul oscuro',
  'azul marino': 'Azul marino',
};
function stripD(s: string): string { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
export function cleanRawValue(raw: unknown): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  s = s.replace(/^(for|fit for|compatible with|for Apple)\s+/i, '').trim();
  s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
export function translateColorValue(cleaned: string): string {
  // "for iPad black" / "para iPad negro" / "compatible with iPad green" -> solo el color.
  const s = cleaned.replace(
    /^(for|fit for|compatible with|compatible con|apto para|para)\s+(apple\s+|el\s+|la\s+)?(ipad|iphone|ipad\s*pro|galaxy\s*\w*|tablet)\s+/i,
    '',
  ).trim();
  const key = stripD(s).toLowerCase().trim();
  if (COLOR_ES[key]) return COLOR_ES[key];
  const parts = key.split(/\s+/);
  const last = parts[parts.length - 1] || '';
  if (parts.length <= 2 && COLOR_ES[last] && !/\d/.test(key)) {
    const label = COLOR_ES[last] as string;
    if (parts.length === 1) return label;
    if (parts[0] === 'dark') return label + ' oscuro';
    if (parts[0] === 'light') return label + ' claro';
    if (parts[0] === 'deep') return label + ' intenso';
    if (parts[0] === 'sky') return COLOR_ES['sky'] as string;
    if (/^(ipad|iphone|galaxy|tablet)$/.test(parts[0])) return label;
  }
  return s;
}

/** Palabras de familia de modelo reconocidas para unir con " / ". */
const MODEL_FAMILY_WORDS = /^(pro|air|mini|max|ultra|plus|se|cellular|wifi|wi-fi)$/i;

/**
 * Presentacion segura de un valor de modelo (FASE 4): solo reformatea cuando
 * el patron es inequivoco; si duda, devuelve el texto limpio original.
 *   "iPad 7 8 9th 10.2in"    -> "iPad 7 / 8 / 9 — 10.2\""
 *   "iPad Air3 Pro 10.5in"   -> "iPad Air 3 / Pro — 10.5\""
 *   "iPad Mini 4 5 7.9in"    -> "iPad Mini 4 / 5 — 7.9\""
 *   "iPad Air4 Air5 10.9"    -> "iPad Air 4 / 5 — 10.9\""
 *   "iPad Pro 11 2022"       -> "iPad Pro 11 — 2022"
 *   "iPad Air11 2024 2025"   -> "iPad Air 11 — 2024 / 2025"
 * Es idempotente: un valor ya presentado no se vuelve a tocar.
 */
export function presentModelValue(value: string): string {
  const s = String(value ?? '').trim();
  if (!s || s.includes('—') || s.includes(' / ')) return s;
  const m = s.match(/^(?:para\s+|fit\s+para\s+)?(ipad|iphone|galaxy\s*tab(?:let)?|tablet)\s+(.+)$/i);
  if (!m || !m[1] || !m[2]) return s;
  // Marca canonica ("ipad" -> "iPad"; "para iPad ..." ya quedo sin prefijo).
  const rawBrand = m[1].toLowerCase().replace(/\s+/g, ' ');
  const brand = rawBrand === 'iphone' ? 'iPhone'
    : rawBrand === 'ipad' ? 'iPad'
      : rawBrand === 'tablet' ? 'Tablet'
        : rawBrand === 'galaxy tab' ? 'Galaxy Tab'
          : rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1);
  const words = m[2]
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bde\s+((?:19|20)\d{2})\b/gi, '$1')              // "de 2024" -> "2024"
    .replace(/(\d+)\.?\s*[ªº°]?\s*generaci[oó]n\b/gi, '$1')    // "7.ª generación" -> "7"
    .replace(/\s*(?:pulgadas?|inch(?:es)?|in\.?)\s*$/i, 'in')  // "10.2 pulgadas" -> "10.2in"
    .split(/\s+/).filter(Boolean);
  if (!words.length) return s;

  // Anios al final ("2022", "2024 2025", "2017-18").
  const years: string[] = [];
  while (words.length && /^(19|20)\d{2}(?:[-/](?:19|20)?\d{2})?$/.test(words[words.length - 1])) {
    years.unshift(words.pop() as string);
  }

  // Tamano al final: 10.2in / 10.2" / 10.9 (decimal o con unidad; un entero
  // suelto puede ser numero de modelo, p.ej. "iPad Pro 11").
  let size = '';
  const lastWord = words[words.length - 1] ?? '';
  const sizeM = lastWord.match(/^(\d{1,2}(?:\.\d{1,2})?)(?:in(?:ch)?|["”])?$/i);
  if (sizeM && (/\d\.\d/.test(lastWord) || /in(?:ch)?|["”]/i.test(lastWord))) {
    size = sizeM[1];
    words.pop();
  }
  if (!words.length) return s;

  // Tokens: palabras y numeros (expande "Air3" -> Air+3, "9th" -> 9).
  const tokens: { kind: 'word' | 'num'; text: string }[] = [];
  for (const w of words) {
    const ord = w.match(/^(\d+)(th|st|nd|rd)$/i);
    if (ord) { tokens.push({ kind: 'num', text: ord[1] }); continue; }
    const att = w.match(/^([a-zA-Z]{2,})(\d+)$/);
    if (att) {
      tokens.push({ kind: 'word', text: att[1] });
      tokens.push({ kind: 'num', text: att[2] });
      continue;
    }
    if (/^\d+$/.test(w)) { tokens.push({ kind: 'num', text: w }); continue; }
    if (/^[a-zA-Z]\d{1,2}$|^\d[a-zA-Z]{1,3}$/.test(w)) { tokens.push({ kind: 'word', text: w }); continue; } // A16, M4, 3D
    if (!/^[a-zA-Z0-9ñÑáéíóúü.+/-]+$/.test(w)) return s; // token raro: no tocar
    tokens.push({ kind: 'word', text: w });
  }

  // Colapsa "Air 4 Air 5" -> "Air 4 / 5" (misma palabra repetida).
  for (let i = 0; i < tokens.length - 3; i++) {
    if (tokens[i].kind === 'word' && tokens[i + 1].kind === 'num'
      && tokens[i + 2].kind === 'word' && tokens[i + 3].kind === 'num'
      && tokens[i].text.toLowerCase() === tokens[i + 2].text.toLowerCase()) {
      const word = tokens[i];
      const nums = [tokens[i + 1].text, tokens[i + 3].text];
      let j = i + 4;
      while (j + 1 < tokens.length && tokens[j].kind === 'word'
        && tokens[j].text.toLowerCase() === word.text.toLowerCase()
        && tokens[j + 1].kind === 'num') {
        nums.push(tokens[j + 1].text);
        j += 2;
      }
      tokens.splice(i, j - i,
        { kind: 'word', text: word.text },
        { kind: 'num', text: nums.join(' / ') });
    }
  }

  // Agrupa numeros consecutivos: 7 8 9 -> "7 / 8 / 9" (sin duplicados).
  const segments: { kind: 'word' | 'num'; text: string }[] = [];
  for (const t of tokens) {
    const prev = segments[segments.length - 1];
    if (t.kind === 'num' && prev?.kind === 'num') {
      if (prev.text !== t.text) prev.text = `${prev.text} / ${t.text}`;
    } else {
      segments.push({ ...t });
    }
  }

  // Sin nada que reformatear: mantener el texto original.
  if (!segments.some((x) => x.kind === 'num') && !size && !years.length) return s;

  let body = '';
  segments.forEach((seg, idx) => {
    if (idx === 0) { body = seg.text; return; }
    const prev = segments[idx - 1];
    const joinSlash = prev.kind === 'num' && seg.kind === 'word'
      && MODEL_FAMILY_WORDS.test(seg.text);
    body += `${joinSlash ? ' / ' : ' '}${seg.text}`;
  });
  const tail: string[] = [];
  if (size) tail.push(`${size}"`);
  if (years.length) tail.push(years.join(' / '));
  return `${brand} ${body}${tail.length ? ` — ${tail.join(' — ')}` : ''}`;
}

/** El valor parece un modelo de dispositivo (iPad/Galaxy/...) y no una talla real. */
const DEVICE_MODEL_HINT = new RegExp([
  '\\b(?:ipad|iphone|galaxy|tablet)\\b',
  '\\bpulgadas?\\b',
  '\\b\\d+(?:\\.\\d+)?\\s*(?:in|inch|pulg|["”])\\b',
  '\\b(?:pro|air|mini|max|ultra)\\s+\\d',
  '(?:^|\\s)(?:19|20)\\d{2}(?:\\s|$)',
].join('|'), 'i');

/**
 * Nombre de atributo para presentacion: "Talla: iPad Air3 Pro 10.5 pulgadas"
 * es un Modelo. Solo renombra cuando el valor lo confirma; las tallas reales
 * (M, XL, 40...) se mantienen.
 */
export function presentAttributeName(name: unknown, value: unknown): string {
  const n = String(name ?? '').trim();
  if (/^(talla|size)$/i.test(n) && DEVICE_MODEL_HINT.test(String(value ?? ''))) return 'Modelo';
  return n;
}

/**
 * Presentacion de un valor de atributo (FASE 2/3/4): Color -> espanol,
 * Modelo -> formato seguro. El valor raw interno se conserva en el motor
 * (sku / supplierVariantId) y nunca se usa el texto visual como identificador.
 */
export function presentAttributeValue(name: unknown, value: unknown): string {
  const v = String(value ?? '').trim();
  if (!v) return v;
  const attr = String(name ?? '');
  if (/^colou?r/i.test(attr)) return translateColorValue(v);
  if (/^(modelo|talla|size)/i.test(attr)) return presentModelValue(v);
  return v;
}
function lkModel(v: string): boolean {
  return /ipad|iphone|galaxy|tablet|pro\s*\d|air\s*\d|mini\s*\d|\d\s*(in|inch|"|”|mm|cm)|\d+(th|st|nd|rd)\b/i.test(v);
}
function lkColor(v: string, attr: string): boolean {
  if (/colou?r/i.test(attr)) return true;
  const key = stripD(v).toLowerCase().trim();
  if (COLOR_ES[key]) return true;
  const last = key.split(/\s+/).pop() || '';
  if (COLOR_ES[last] && !/\d/.test(key) && key.split(/\s+/).length <= 2) return true;
  return false;
}
function lkSize(v: string, attr: string): boolean {
  if (/talla|tama/i.test(attr)) return true;
  if (/size/i.test(attr) && lkModel(v)) return false;
  return /^(xxs|xs|s|m|l|xl|xxl|xxxl|\d+(\.\d+)?\s*(in|inch|"|”|mm|cm)?)$/i.test(v.trim());
}
export function inferAttributeName(rawName: unknown, cleanedValue: string): string {
  const raw = String(rawName ?? '').trim();
  if (/colou?r|colou?r/i.test(raw)) return 'Color';
  if (/talla|tama/i.test(raw)) {
    // "Talla: iPad Air3 Pro 10.5 pulgadas" es un Modelo, no una talla.
    if (lkSize(cleanedValue, raw) && !lkModel(cleanedValue)) return 'Talla';
    return 'Modelo';
  }
  if (/^size$/i.test(raw)) {
    if (lkSize(cleanedValue, raw) && !lkModel(cleanedValue)) return 'Talla';
    return 'Modelo';
  }
  if (/model|modelo|style|tipo|type|version|versi|compatible|device|applicable/i.test(raw)) return 'Modelo';
  if (/ship\s*from|almacen|warehouse/i.test(raw)) return 'Despacho';
  if (lkColor(cleanedValue, raw)) return 'Color';
  if (lkModel(cleanedValue)) return 'Modelo';
  if (lkSize(cleanedValue, raw)) return 'Talla';
  const generic = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!generic || /^(prop|attr|attribute|option|spec|sku|a?\d+)$/i.test(generic)) return 'Modelo';
  return generic.length <= 24 ? generic.charAt(0).toUpperCase() + generic.slice(1) : 'Modelo';
}
export function parseSkuAttr(skuAttr: unknown): { rawName: string; rawValue: string }[] {
  const s = String(skuAttr ?? '').trim();
  if (!s) return [];
  const segs = s.split(';').map((x) => x.trim()).filter(Boolean);
  const technical = segs.some((seg) => /^\d+\s*:\s*\d+#/.test(seg));
  if (!technical) {
    if (s.includes(':')) {
      return segs.map((seg) => {
        const i = seg.indexOf(':');
        return { rawName: seg.slice(0, i).trim() || 'Modelo', rawValue: seg.slice(i + 1).trim() };
      }).filter((x) => x.rawValue);
    }
    return s.split('/').map((x) => x.trim()).filter(Boolean).map((rawValue) => ({ rawName: '', rawValue }));
  }
  return segs.map((seg) => {
    const h = seg.indexOf('#');
    const left = h >= 0 ? seg.slice(0, h) : seg;
    const rawValue = h >= 0 ? seg.slice(h + 1).trim() : seg.trim();
    const propId = (left.split(':')[0] || '').trim() || '';
    return { rawName: propId, rawValue };
  }).filter((x) => x.rawValue);
}
export function commercialValue(rawValue: string, attrName: string): string {
  const cleaned = cleanRawValue(rawValue);
  if (!cleaned) return '';
  if (/^color$/i.test(attrName) || lkColor(cleaned, attrName)) return translateColorValue(cleaned);
  if (attrName === 'Modelo') return presentModelValue(cleaned);
  return cleaned;
}
export function toCommercialAttribute(rawName: unknown, rawValue: unknown): CleanAttribute | null {
  const cleaned = cleanRawValue(rawValue);
  if (!cleaned) return null;
  const trailing = trailingModelColor(cleaned);
  if (trailing) return { name: 'Color', value: trailing };
  const name = inferAttributeName(rawName, cleaned);
  return { name, value: commercialValue(cleaned, name) };
}
function trailingModelColor(cleaned: string): string | null {
  if (!/ipad|iphone|galaxy|tablet/i.test(cleaned)) return null;
  const parts = stripD(cleaned).toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1] as string;
  const label = COLOR_ES[last];
  if (!label) return null;
  const prev = parts[parts.length - 2] as string;
  if (prev === 'dark') return label + ' oscuro';
  if (prev === 'light') return label + ' claro';
  if (prev === 'deep') return label + ' intenso';
  return label;
}
/**
 * Entrada generica de atributos de una variante.
 * Funciona para AliExpress, CJ, Temu, Amazon y productos manuales:
 * cada proveedor entrega la informacion en un campo distinto y aqui se unifica.
 */
export interface VariantAttributeInput {
  /** Atributos estructurados del proveedor: [{ name, value }]. */
  attributes?: unknown;
  /** Campo comercial explicito (CJ / manual). */
  color?: unknown;
  size?: unknown;
  /** Nombre comercial de la variante ("Rojo / M", "Color: Rojo; Modelo: Air"). */
  name?: unknown;
  /** Cadena tecnica de atributos ("5:1394#iPad;14:193#for iPad black"). */
  skuAttr?: unknown;
  sku?: unknown;
}

/** El valor es un codigo/ID de proveedor (nunca debe mostrarse al cliente). */
export function isTechnicalCode(value: unknown): boolean {
  const v = String(value ?? '').trim();
  if (!v) return true;
  if (/[#;]/.test(v)) return false;
  if (lkColor(v, '') || lkSize(v, '') || lkModel(v)) return false;
  if (/\s/.test(v)) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(v)) return false;
  if (v.length >= 8) return true;
  return /[A-Za-z]/.test(v) && /\d/.test(v) && v.length >= 5;
}

/** La cadena contiene marcadores de atributo y no un SKU/ID plano. */
export function hasAttributeMarkers(value: unknown): boolean {
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (/#/.test(s) || /;/.test(s)) return true;
  if (/:(?!\/\/)/.test(s)) return true;
  if (/\//.test(s)) {
    return s.split('/').map((p) => p.trim()).filter(Boolean)
      .some((p) => lkColor(p, '') || lkSize(p, '') || lkModel(p));
  }
  return false;
}

function parseFallbackAttributes(raw: unknown, requireMarkers: boolean): CleanAttribute[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  if (requireMarkers && !hasAttributeMarkers(s)) return [];
  const out: CleanAttribute[] = [];
  parseSkuAttr(s).forEach((seg, idx) => {
    const c = toCommercialAttribute(seg.rawName || 'a' + idx, seg.rawValue);
    if (c && c.value && !isTechnicalCode(c.value)) out.push(c);
  });
  return out;
}

/**
 * Resuelve los atributos comerciales de una variante sin importar el proveedor.
 * Orden: atributos estructurados -> color/size -> nombre comercial -> skuAttr.
 * Siempre descarta codigos tecnicos (los IDs quedan solo del lado interno).
 */
export function extractVariantAttributes(input: VariantAttributeInput | null | undefined): CleanAttribute[] {
  const out: CleanAttribute[] = [];
  const structured: unknown[] = Array.isArray(input?.attributes) ? (input?.attributes as unknown[]) : [];
  structured.forEach((a, idx) => {
    const o = a as { name?: unknown; value?: unknown };
    const c = toCommercialAttribute(o?.name ?? 'a' + idx, o?.value);
    if (c && c.value) out.push(c);
  });
  if (out.length) return fixDupes(out);

  const color = cleanRawValue(input?.color);
  if (color && !isTechnicalCode(color)) {
    out.push({ name: 'Color', value: commercialValue(color, 'Color') });
  }
  const size = cleanRawValue(input?.size);
  if (size && !isTechnicalCode(size)) {
    const name = lkSize(size, 'talla') && !lkModel(size) ? 'Talla' : 'Modelo';
    out.push({ name, value: commercialValue(size, name) });
  }
  if (out.length) return fixDupes(out);

  const fromName = parseFallbackAttributes(input?.name, true);
  if (fromName.length) return fixDupes(fromName);

  return fixDupes(parseFallbackAttributes(input?.skuAttr ?? input?.sku, true));
}

/** Compatibilidad: recibe el objeto crudo con { attributes, skuAttr, sku, color, size, name }. */
export function extractAttributes(variantJson: unknown): CleanAttribute[] {
  const v = (variantJson ?? {}) as VariantAttributeInput;
  return extractVariantAttributes({
    attributes: v.attributes,
    color: v.color,
    size: v.size,
    name: v.name,
    skuAttr: v.skuAttr,
    sku: v.sku,
  });
}
function fixDupes(attrs: CleanAttribute[]): CleanAttribute[] {
  const seen = new Map<string, number>();
  return attrs.map((a) => {
    const n = seen.get(a.name) ?? 0;
    seen.set(a.name, n + 1);
    if (n === 0) return a;
    if (a.name === 'Modelo' && lkColor(a.value, '')) return { name: 'Color', value: a.value };
    return { name: a.name + ' ' + (n + 1), value: a.value };
  });
}
export function normalizeVariant(raw: unknown): NormalizedVariant {
  const r = raw as Record<string, unknown>;
  const json = (r?._json ?? {}) as Record<string, unknown>;
  const attrs = extractAttributes({
    attributes: (r?.supplierAttributes ?? json?.attributes) as unknown,
    skuAttr: (json?.skuAttr ?? r?.skuAttr ?? r?.sku ?? '') as unknown,
    sku: (r?.sku ?? '') as unknown,
  });
  return {
    id: String(r?.id ?? r?.supplierVariantId ?? r?.sku ?? ''),
    sku: String(r?.sku ?? r?.supplierVariantId ?? ''),
    supplierVariantId: r?.supplierVariantId ? String(r.supplierVariantId) : undefined,
    price: Number(r?.price ?? json?.salePriceClp ?? 0) || 0,
    stock: Number(r?.stock ?? 0) || 0,
    image: (json?.image ?? r?.supplierImage ?? r?.image ?? undefined) as string | undefined,
    supplierCost: (r?.supplierCostUsd ?? json?.costUsd ?? null) as number | null,
    supplierShipping: (r?.supplierShippingUsd ?? json?.shippingUsd ?? null) as number | null,
    attributes: attrs,
  };
}
export function groupAttributes(variants: NormalizedVariant[]): AttributeGroup[] {
  const order: string[] = [];
  const values = new Map<string, string[]>();
  for (const v of variants) {
    for (const a of v.attributes) {
      if (!values.has(a.name)) { values.set(a.name, []); order.push(a.name); }
      const list = values.get(a.name) as string[];
      if (!list.includes(a.value)) list.push(a.value);
    }
  }
  const rank = (n: string): number => (n === 'Modelo' ? 0 : n === 'Color' ? 1 : n === 'Talla' ? 2 : 3);
  return order.map((name) => ({ name, options: values.get(name) || [] }))
    .filter((g) => g.options.length > 0)
    .sort((a, b) => rank(a.name) - rank(b.name) || order.indexOf(a.name) - order.indexOf(b.name));
}
export function hasRealVariants(variants: NormalizedVariant[]): boolean {
  if (!Array.isArray(variants) || variants.length < 2) return false;
  return groupAttributes(variants).length > 0;
}
export function findVariantForSelection(
  variants: NormalizedVariant[], selection: Record<string, string>,
): NormalizedVariant | undefined {
  const keys = Object.keys(selection);
  if (!keys.length) return undefined;
  return variants.find((v) => keys.every((k) => v.attributes.some((a) => a.name === k && a.value === selection[k])));
}
export function isOptionAvailable(
  variants: NormalizedVariant[], groupName: string, option: string,
  current: Record<string, string>,
): boolean {
  const m = findVariantForSelection(variants, { ...current, [groupName]: option });
  return !!m && m.stock > 0;
}
