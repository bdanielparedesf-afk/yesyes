import axios from 'axios';
import { z } from 'zod';
import {
  AliExpressDropshipError, buildDropshipRequest, DROPSHIP_METHODS, DropshipConfig,
  DropshipMethod, DropshipRequest,
} from './dropship-request';
import {
  buyerFreightInputSchema, buyerFreightResultSchema, BuyerFreightCalculateInput, BuyerFreightResult,
  freightQueryInputSchema, freightQueryResultSchema, FreightQueryInput, FreightQueryResult,
  imageSearchInputSchema, imageSearchResultSchema, ImageSearchV2Input, ImageSearchV2Result,
  productInputSchema, productResultSchema, ProductGetInput, ProductGetResult,
  textInputSchema, textSearchResultSchema, TextSearchInput, TextSearchResult,
  wholesaleInputSchema, wholesaleResultSchema, ProductWholesaleGetInput, ProductWholesaleGetResult,
} from './dropship-catalog-types';
import {
  categoryGetInputSchema, categoryGetResultSchema, categoryTreeInputSchema, categoryTreeResponseSchema,
  CategoryGetInput, CategoryGetResult, CategoryTreeInput, CategoryTreeNode, feedItemIdsInputSchema,
  feedItemIdsResultSchema, FeedItemIdsInput, FeedItemIdsResult, parseCategoryTree,
} from './dropship-taxonomy-types';
import {
  orderCreateInputSchema, orderCreateResultSchema, orderGetInputSchema, orderGetResultSchema,
  orderTrackingInputSchema, orderTrackingResultSchema, OrderCreateInput, OrderCreateResult,
  OrderGetInput, OrderGetResult, OrderTrackingInput, OrderTrackingResult,
} from './dropship-order-types';

export { AliExpressDropshipError, DROPSHIP_ENDPOINT, DROPSHIP_METHODS, DROPSHIP_METHOD_NAMES } from './dropship-request';
export type { DropshipConfig, DropshipFailure, DropshipMethod, DropshipRequest } from './dropship-request';
export * from './dropship-types';

export type DropshipTransport = (request: DropshipRequest) => Promise<unknown>;
const object = z.record(z.unknown());

function isSuccessCode(value: unknown): boolean {
  return value === undefined || value === null || [0, '0', 200, '200'].includes(value as number | string);
}

/**
 * Validates the gateway envelope and returns the method's business payload.
 * Lists are normalized by the method schemas (see dropship-common.dropshipList).
 * No raw provider text is ever attached to the thrown error.
 */
export function parseDropshipResponse(raw: unknown, method: DropshipMethod): Record<string, unknown> {
  const root = object.safeParse(raw);
  if (!root.success) throw new AliExpressDropshipError('CONTRACT');
  const data = root.data;
  if (data.error_response !== undefined) {
    const error = object.safeParse(data.error_response);
    throw new AliExpressDropshipError('REJECTED', error.success ? error.data.code : undefined);
  }
  if (!isSuccessCode(data.code)) throw new AliExpressDropshipError('REJECTED', data.code);
  const envelope = object.safeParse(data[method.replace(/\./g, '_') + '_response']);
  if (!envelope.success) throw new AliExpressDropshipError('CONTRACT');
  const env = envelope.data;
  if (env.success === false || env.success === 'false' || env.ret === false || env.ret === 'false') {
    throw new AliExpressDropshipError('REJECTED');
  }
  const contract = DROPSHIP_METHODS[method];
  if (contract.resultKey === 'self') return env;
  const payload = object.safeParse(env[contract.resultKey]);
  if (!payload.success) throw new AliExpressDropshipError('CONTRACT');
  if (payload.data.success === false || payload.data.success === 'false') throw new AliExpressDropshipError('REJECTED');
  return payload.data;
}

const transport: DropshipTransport = async request => {
  try {
    const response = await axios.post<unknown>(request.url, request.body, {
      headers: request.headers, timeout: 15000, maxRedirects: 0, proxy: false,
      maxContentLength: 4194304, maxBodyLength: 4194304,
    });
    return response.data;
  } catch (error) {
    throw new AliExpressDropshipError(axios.isAxiosError(error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code || '')
      ? 'TIMEOUT' : 'TRANSPORT');
  }
};

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

/** Backend only. Never log requests, tokens or raw errors. No automatic retries. */
export class AliExpressDropshipClient {
  #config: DropshipConfig;
  constructor(config: DropshipConfig, private readonly send: DropshipTransport = transport,
    private readonly now: () => number = Date.now) {
    if (!config || !/^\d+$/.test(config.appKey) || !config.appSecret?.trim() || !config.accessToken?.trim()) {
      throw new AliExpressDropshipError('CONFIGURATION');
    }
    this.#config = { ...config };
  }

  // ── Priority 1: catalog ────────────────────────────────────────────────────
  async textSearch(input: TextSearchInput): Promise<TextSearchResult> {
    const parsed = textInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.ds.text.search', parsed.data, textSearchResultSchema);
  }

  async productGet(input: ProductGetInput): Promise<ProductGetResult> {
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    const result = await this.validated('aliexpress.ds.product.get', parsed.data, productResultSchema);
    if (String(result.ae_item_base_info_dto.product_id) !== String(parsed.data.product_id)) {
      throw new AliExpressDropshipError('CONTRACT');
    }
    return result;
  }

  async productWholesaleGet(input: ProductWholesaleGetInput): Promise<ProductWholesaleGetResult> {
    const parsed = wholesaleInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    const result = await this.validated('aliexpress.ds.product.wholesale.get', parsed.data, wholesaleResultSchema);
    if (String(result.ae_item_base_info_dto.product_id) !== String(parsed.data.product_id)) {
      throw new AliExpressDropshipError('CONTRACT');
    }
    return result;
  }

  /** Official contract wraps every field inside the `queryDeliveryReq` object. */
  async freightQuery(input: FreightQueryInput): Promise<FreightQueryResult> {
    const parsed = freightQueryInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.ds.freight.query', {
      queryDeliveryReq: stripUndefined({ ...parsed.data }),
    }, freightQueryResultSchema);
  }

  async buyerFreightCalculate(input: BuyerFreightCalculateInput): Promise<BuyerFreightResult> {
    const parsed = buyerFreightInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.logistics.buyer.freight.calculate', {
      param_aeop_freight_calculate_for_buyer_d_t_o: stripUndefined({ ...parsed.data }),
    }, buyerFreightResultSchema);
  }

  async imageSearchV2(input: ImageSearchV2Input): Promise<ImageSearchV2Result> {
    const parsed = imageSearchInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.ds.image.searchV2', {
      param0: stripUndefined({ ...parsed.data }),
    }, imageSearchResultSchema);
  }

  // ── Priority 3: taxonomy & feed ────────────────────────────────────────────
  /** `result` is a JSON string; it is parsed and normalized to typed nodes. */
  async categoryTreeGet(input: CategoryTreeInput = {}): Promise<CategoryTreeNode[]> {
    const parsed = categoryTreeInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    const envelope = await this.validated('aliexpress.ds.category.tree.get', parsed.data, categoryTreeResponseSchema);
    try { return parseCategoryTree(envelope.result); } catch { throw new AliExpressDropshipError('CONTRACT'); }
  }

  async categoryGet(input: CategoryGetInput = {}): Promise<CategoryGetResult> {
    const parsed = categoryGetInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.ds.category.get', parsed.data, categoryGetResultSchema);
  }

  async feedItemIdsGet(input: FeedItemIdsInput): Promise<FeedItemIdsResult> {
    const parsed = feedItemIdsInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.ds.feed.itemids.get', parsed.data, feedItemIdsResultSchema);
  }

  // ── Priority 2: orders ─────────────────────────────────────────────────────
  /**
   * MUTATING method. Requires `confirm: true`; the service layer is additionally
   * responsible for the environment kill-switch. Automated tests never call it.
   */
  async orderCreate(input: OrderCreateInput, options: { confirm: boolean }): Promise<OrderCreateResult> {
    if (options?.confirm !== true) throw new AliExpressDropshipError('NOT_CONFIRMED');
    const parsed = orderCreateInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.ds.order.create', {
      ...parsed.data,
      ds_extend_request: parsed.data.ds_extend_request
        ? stripUndefined({ ...parsed.data.ds_extend_request }) : undefined,
    }, orderCreateResultSchema);
  }

  async orderGet(input: OrderGetInput): Promise<OrderGetResult> {
    const parsed = orderGetInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.trade.ds.order.get', {
      single_order_query: { order_id: parsed.data.order_id },
    }, orderGetResultSchema);
  }

  async orderTrackingGet(input: OrderTrackingInput): Promise<OrderTrackingResult> {
    const parsed = orderTrackingInputSchema.safeParse(input);
    if (!parsed.success) throw new AliExpressDropshipError('INPUT');
    return this.validated('aliexpress.ds.order.tracking.get', parsed.data, orderTrackingResultSchema);
  }

  private async validated<T extends z.ZodTypeAny>(method: DropshipMethod,
    input: Record<string, unknown>, schema: T): Promise<z.infer<T>> {
    const payload = await this.call(method, input);
    const result = schema.safeParse(payload);
    if (!result.success) throw new AliExpressDropshipError('CONTRACT');
    return result.data;
  }

  private async call(method: DropshipMethod, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const request = buildDropshipRequest(this.#config, method, input as Record<string,
      string | number | boolean | Record<string, unknown> | unknown[]>, this.now());
    let raw: unknown;
    try {
      raw = await this.send(request);
    } catch (error) {
      throw new AliExpressDropshipError(error instanceof AliExpressDropshipError ? error.reason : 'TRANSPORT');
    }
    return parseDropshipResponse(raw, method);
  }
}

