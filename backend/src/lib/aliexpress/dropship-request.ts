import { createHmac } from 'node:crypto';

export const DROPSHIP_ENDPOINT = 'https://api-sg.aliexpress.com/sync';
export type DropshipMethod =
  | 'aliexpress.ds.text.search'
  | 'aliexpress.ds.product.get'
  | 'aliexpress.ds.product.wholesale.get'
  | 'aliexpress.ds.freight.query'
  | 'aliexpress.logistics.buyer.freight.calculate'
  | 'aliexpress.ds.image.searchV2'
  | 'aliexpress.ds.category.tree.get'
  | 'aliexpress.ds.category.get'
  | 'aliexpress.ds.feed.itemids.get'
  | 'aliexpress.ds.order.create'
  | 'aliexpress.trade.ds.order.get'
  | 'aliexpress.ds.order.tracking.get';

/** Where the business payload lives inside the `<method>_response` envelope. */
export type DropshipResultKey = 'data' | 'result' | 'resp_result' | 'self';

export interface DropshipMethodContract {
  /** Official top-level request parameters for the method. */
  readonly params: readonly string[];
  /** Parameters carrying nested structures, sent as one JSON string field. */
  readonly json: readonly string[];
  /** Envelope member holding the business payload. */
  readonly resultKey: DropshipResultKey;
  /** Methods that mutate provider state (orders). Never executed implicitly. */
  readonly mutating: boolean;
}

/**
 * Official request contracts. Values are taken verbatim from the captured public
 * API reference payloads (backend/docs/api-contracts/*.md). Nothing is inferred:
 * parameter names, nested `Object` parameters, required flags and response
 * containers all come from that source.
 * The gateway receives nested parameters as a single JSON-encoded field, exactly
 * as the official request demos show (e.g. queryDeliveryReq={"quantity":1,...}).
 */
export const DROPSHIP_METHODS: Readonly<Record<DropshipMethod, DropshipMethodContract>> = {
  'aliexpress.ds.text.search': {
    params: ['keyWord', 'local', 'countryCode', 'categoryId', 'sortBy', 'pageSize', 'pageIndex',
      'currency', 'searchExtend', 'selectionName'],
    json: ['searchExtend'], resultKey: 'data', mutating: false,
  },
  'aliexpress.ds.product.get': {
    params: ['ship_to_country', 'product_id', 'target_currency', 'target_language',
      'remove_personal_benefit', 'biz_model', 'province_code', 'city_code'],
    json: [], resultKey: 'result', mutating: false,
  },
  'aliexpress.ds.product.wholesale.get': {
    params: ['ship_to_country', 'product_id', 'target_currency', 'target_language',
      'remove_personal_benefit'],
    json: [], resultKey: 'result', mutating: false,
  },
  'aliexpress.ds.freight.query': {
    params: ['queryDeliveryReq'], json: ['queryDeliveryReq'], resultKey: 'result', mutating: false,
  },
  'aliexpress.logistics.buyer.freight.calculate': {
    params: ['param_aeop_freight_calculate_for_buyer_d_t_o'],
    json: ['param_aeop_freight_calculate_for_buyer_d_t_o'], resultKey: 'result', mutating: false,
  },
  'aliexpress.ds.image.searchV2': {
    params: ['param0'], json: ['param0'], resultKey: 'result', mutating: false,
  },
  'aliexpress.ds.category.tree.get': {
    params: ['lang'], json: [], resultKey: 'self', mutating: false,
  },
  'aliexpress.ds.category.get': {
    params: ['categoryId', 'language', 'app_signature'], json: [], resultKey: 'resp_result', mutating: false,
  },
  'aliexpress.ds.feed.itemids.get': {
    params: ['page_size', 'category_id', 'feed_name', 'search_id'], json: [], resultKey: 'result', mutating: false,
  },
  'aliexpress.ds.order.create': {
    params: ['ds_extend_request', 'param_place_order_request4_open_api_d_t_o'],
    json: ['ds_extend_request', 'param_place_order_request4_open_api_d_t_o'],
    resultKey: 'result', mutating: true,
  },
  'aliexpress.trade.ds.order.get': {
    params: ['single_order_query'], json: ['single_order_query'], resultKey: 'result', mutating: false,
  },
  'aliexpress.ds.order.tracking.get': {
    params: ['ae_order_id', 'language'], json: [], resultKey: 'result', mutating: false,
  },
};

export const DROPSHIP_METHOD_NAMES = Object.freeze(Object.keys(DROPSHIP_METHODS) as DropshipMethod[]);

/** Official common parameter carrying the access token for every DS method. */
export const DROPSHIP_AUTH_PARAMETER = 'access_token';


export interface DropshipRequest {
  url: string; method: 'POST'; headers: Record<string, string>; body: string;
}
export interface DropshipConfig { appKey: string; appSecret: string; accessToken: string }
export type DropshipFailure = 'CONFIGURATION' | 'INPUT' | 'TIMEOUT' | 'TRANSPORT' | 'REJECTED'
  | 'CONTRACT' | 'BLOCKED' | 'NOT_CONFIRMED';
export class AliExpressDropshipError extends Error {
  readonly providerCode?: string;
  constructor(public readonly reason: DropshipFailure, providerCode?: unknown) {
    super({ CONFIGURATION: 'Configuración Dropship incompleta.', INPUT: 'Parámetros Dropship inválidos.',
      TIMEOUT: 'La consulta Dropship agotó el tiempo de espera.', TRANSPORT: 'No fue posible consultar AliExpress.',
      REJECTED: 'AliExpress rechazó la consulta Dropship.', CONTRACT: 'Respuesta Dropship no reconocida.',
      BLOCKED: 'Método Dropship bloqueado: falta autorización explícita.',
      NOT_CONFIRMED: 'Operación Dropship no confirmada por el administrador.' }[reason]);
    this.name = 'AliExpressDropshipError';
    // Never forward arbitrary provider text (it can echo a token or request).
    const code = typeof providerCode === 'string' || typeof providerCode === 'number' ? String(providerCode) : '';
    if (/^\d{1,6}$/.test(code) || ['InvalidAppKey', 'InvalidAppkey', 'IncompleteSignature',
      'InvalidSignature', 'InvalidSession', 'MissingParameter', 'InvalidParameter',
      'InsufficientPermission', 'ServiceUnavailable'].includes(code)) this.providerCode = code;
  }
}

/** /sync business signing: sorted raw UTF-8 key/value pairs, excluding sign.
 * Unlike REST OAuth, the canonical string has no API path prefix.
 * Kept separate from oauth-request.ts; local vectors are not provider certification.
 */
export function signDropshipParameters(params: Readonly<Record<string, string>>, secret: string): string {
  if (typeof secret !== 'string' || !secret.trim() || !params || 'sign' in params
    || Object.values(params).some(value => typeof value !== 'string')) {
    throw new AliExpressDropshipError('CONFIGURATION');
  }
  const canonical = Object.keys(params).sort().map(key => key + params[key]).join('');
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex').toUpperCase();
}

export type DropshipInputValue = string | number | boolean | Record<string, unknown> | unknown[];

function serializeInput(input: Readonly<Record<string, DropshipInputValue>>, method: DropshipMethod): Record<string, string> {
  const contract = DROPSHIP_METHODS[method];
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (!contract.params.includes(key)) throw new AliExpressDropshipError('INPUT');
    if (contract.json.includes(key)) {
      if (typeof value !== 'object') throw new AliExpressDropshipError('INPUT');
      try { out[key] = JSON.stringify(value); } catch { throw new AliExpressDropshipError('INPUT'); }
      continue;
    }
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new AliExpressDropshipError('INPUT');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new AliExpressDropshipError('INPUT');
    out[key] = String(value);
  }
  return out;
}

export function buildDropshipRequest(config: DropshipConfig, method: DropshipMethod,
  input: Readonly<Record<string, DropshipInputValue>>, timestamp: number): DropshipRequest {
  if (!config || typeof config.appKey !== 'string' || !/^\d+$/.test(config.appKey)
    || typeof config.appSecret !== 'string' || !config.appSecret.trim()
    || typeof config.accessToken !== 'string' || !config.accessToken.trim()
    || !Number.isSafeInteger(timestamp) || timestamp <= 0) throw new AliExpressDropshipError('CONFIGURATION');
  if (!DROPSHIP_METHODS[method]) throw new AliExpressDropshipError('INPUT');
  const params: Record<string, string> = {
    ...serializeInput(input, method),
    method, app_key: config.appKey, [DROPSHIP_AUTH_PARAMETER]: config.accessToken,
    timestamp: String(timestamp), sign_method: 'sha256', v: '2.0', format: 'json',
  };
  const sign = signDropshipParameters(params, config.appSecret);
  return { url: DROPSHIP_ENDPOINT, method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, sign }).toString() };
}
