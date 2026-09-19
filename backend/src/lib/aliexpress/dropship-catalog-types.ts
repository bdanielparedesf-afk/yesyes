import { z } from 'zod';
import { dropshipAmount, dropshipBool, dropshipCount, dropshipId, dropshipJsonString, dropshipList, dropshipOptionalId } from './dropship-common';

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.text.search  (official path params: keyWord, local*, countryCode*,
// categoryId, sortBy, pageSize, pageIndex, currency*, searchExtend[], selectionName)
// ─────────────────────────────────────────────────────────────────────────────
export interface TextSearchInput {
  keyWord?: string; local?: string; countryCode?: 'CL'; currency?: 'USD';
  categoryId?: string; sortBy?: string; pageSize?: number; pageIndex?: number;
  searchExtend?: { searchKey: string; searchValue: string; max?: string; min?: string }[];
  selectionName?: string;
}

export const textInputSchema = z.object({
  keyWord: z.string().trim().min(1).max(256).optional(),
  local: z.string().trim().min(2).max(16).default('es_ES'),
  countryCode: z.literal('CL').default('CL'),
  currency: z.literal('USD').default('USD'),
  categoryId: z.string().regex(/^[1-9]\d*$/).max(20).optional(),
  sortBy: z.string().trim().max(64).optional(),
  pageSize: z.number().int().min(1).max(50).default(20),
  pageIndex: z.number().int().min(1).max(1000).default(1),
  searchExtend: z.array(z.object({
    searchKey: z.string().trim().min(1).max(64),
    searchValue: z.string().trim().min(1).max(256),
    max: z.string().trim().max(64).optional(),
    min: z.string().trim().max(64).optional(),
  })).max(5).optional(),
  selectionName: z.string().trim().max(128).optional(),
}).strict().refine(value => Boolean(value.keyWord) || Boolean(value.searchExtend?.length) || Boolean(value.categoryId), {
  message: 'keyWord, categoryId o searchExtend son necesarios.',
});

export const searchProductSchema = z.object({
  itemId: dropshipId,
  title: z.string().min(1),
  itemMainPic: z.string().optional(),
  salePrice: dropshipAmount.optional(),
  salePriceCurrency: z.string().optional(),
  salePriceFormat: z.string().optional(),
  originalPrice: dropshipAmount.optional(),
  originalPriceCurrency: z.string().optional(),
  originalPriceFormat: z.string().optional(),
  originMinPrice: z.string().optional(),
  targetSalePrice: dropshipAmount.optional(),
  targetSalePriceCurrency: z.string().optional(),
  targetOriginalPrice: dropshipAmount.optional(),
  targetOriginalPriceCurrency: z.string().optional(),
  discount: z.string().optional(),
  orders: z.string().optional(),
  score: z.string().optional(),
  evaluateRate: z.string().optional(),
  cateId: z.string().optional(),
  itemUrl: z.string().optional(),
  productVideoUrl: z.string().optional(),
  type: z.string().optional(),
}).passthrough();
export type SearchProduct = z.infer<typeof searchProductSchema>;

export const textSearchResultSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  msg: z.string().optional(),
  products: dropshipList(searchProductSchema, ['selection_search_product', 'product']).default([]),
  totalCount: dropshipCount.optional(),
  pageIndex: dropshipCount.optional(),
  pageSize: dropshipCount.optional(),
}).passthrough();
export interface TextSearchResult extends z.infer<typeof textSearchResultSchema> {}
// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.product.get / aliexpress.ds.product.wholesale.get
// Official params: ship_to_country*, product_id*, target_currency, target_language,
// remove_personal_benefit, biz_model, province_code, city_code
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductGetInput {
  product_id: string; ship_to_country?: 'CL'; target_currency?: 'USD'; target_language?: 'ES';
  remove_personal_benefit?: boolean; biz_model?: string; province_code?: string; city_code?: string;
}

export const productInputSchema = z.object({
  product_id: z.string().regex(/^[1-9]\d{5,24}$/),
  ship_to_country: z.literal('CL').default('CL'),
  target_currency: z.literal('USD').default('USD'),
  target_language: z.literal('ES').default('ES'),
  remove_personal_benefit: z.boolean().optional(),
  biz_model: z.string().trim().max(32).optional(),
  province_code: z.string().trim().max(32).optional(),
  city_code: z.string().trim().max(32).optional(),
}).strict();

export const wholesaleInputSchema = z.object({
  product_id: z.string().regex(/^[1-9]\d{5,24}$/),
  ship_to_country: z.literal('CL').default('CL'),
  target_currency: z.literal('USD').default('USD'),
  target_language: z.literal('ES').default('ES'),
  remove_personal_benefit: z.boolean().optional(),
}).strict();
export interface ProductWholesaleGetInput {
  product_id: string; ship_to_country?: 'CL'; target_currency?: 'USD'; target_language?: 'ES';
  remove_personal_benefit?: boolean;
}

export const skuPropertySchema = z.object({
  sku_property_id: dropshipOptionalId.optional(),
  property_value_id: dropshipOptionalId.optional(),
  sku_property_name: z.string().optional(),
  property_value_definition_name: z.string().optional(),
  sku_property_value: z.string().optional(),
  sku_image: z.string().optional(),
}).passthrough();

export const wholesalePriceTierSchema = z.object({
  min_quantity: z.string().optional(),
  discount: z.string().optional(),
  wholesale_price: z.string().optional(),
}).passthrough();

export const skuSchema = z.object({
  sku_id: dropshipId,
  sku_attr: z.string().optional(),
  sku_code: z.string().optional(),
  barcode: z.string().optional(),
  ean_code: z.string().optional(),
  sku_price: dropshipAmount,
  offer_sale_price: dropshipAmount.optional(),
  offer_bulk_sale_price: dropshipAmount.optional(),
  channel_discount_price: dropshipAmount.optional(),
  currency_code: z.string().optional(),
  tax_amount: z.string().optional(),
  tax_currency_code: z.string().optional(),
  estimated_import_charges: z.string().optional(),
  sku_available_stock: dropshipCount.optional(),
  ipm_sku_stock: dropshipCount.optional(),
  sku_stock: dropshipBool.optional(),
  sku_bulk_order: dropshipCount.optional(),
  price_include_tax: dropshipBool.optional(),
  limit_strategy: z.string().optional(),
  buy_amount_limit_set_by_promotion: z.string().optional(),
  wholesale_price_tiers: dropshipList(wholesalePriceTierSchema, ['wholesale_price_tier', 'wholesale_price_tiers']).optional(),
  ae_sku_property_dtos: dropshipList(skuPropertySchema, ['ae_sku_property_d_t_o', 'ae_sku_property_dto']).optional(),
}).passthrough();
export type ProductSku = z.infer<typeof skuSchema>;

export const itemPropertySchema = z.object({
  // Provider sends numeric ids, empty strings or -1 sentinels; keep the raw value.
  attr_name_id: z.union([z.string(), z.number()]).optional(),
  attr_value_id: z.union([z.string(), z.number()]).optional(),
  attr_name: z.string().optional(),
  attr_value: z.string().optional(),
  attr_value_unit: z.string().optional(),
  attr_value_start: z.string().optional(),
  attr_value_end: z.string().optional(),
}).passthrough();

export const multimediaSchema = z.object({
  image_urls: z.string().optional(),
  ae_video_dtos: dropshipList(z.object({
    media_id: dropshipOptionalId.optional(),
    media_type: z.string().optional(),
    media_url: z.string().optional(),
    poster_url: z.string().optional(),
    media_status: z.string().optional(),
    ali_member_id: dropshipOptionalId.optional(),
  }).passthrough(), ['ae_video_d_t_o']).optional(),
}).passthrough();

export const storeInfoSchema = z.object({
  store_id: dropshipOptionalId.optional(),
  store_name: z.string().optional(),
  store_country_code: z.string().optional(),
  item_as_described_rating: z.string().optional(),
  communication_rating: z.string().optional(),
  shipping_speed_rating: z.string().optional(),
}).passthrough();

export const packageInfoSchema = z.object({
  gross_weight: z.string().optional(),
  package_length: z.union([z.string(), z.number()]).optional(),
  package_width: z.union([z.string(), z.number()]).optional(),
  package_height: z.union([z.string(), z.number()]).optional(),
  base_unit: z.union([z.string(), z.number()]).optional(),
  product_unit: z.union([z.string(), z.number()]).optional(),
  package_type: dropshipBool.optional(),
}).passthrough();

export const itemBaseInfoSchema = z.object({
  product_id: dropshipId,
  subject: z.string().min(1),
  currency_code: z.string().optional(),
  detail: z.string().optional(),
  mobile_detail: z.string().optional(),
  category_id: dropshipOptionalId.optional(),
  product_status_type: z.string().optional(),
  sales_count: z.string().optional(),
  evaluation_count: z.string().optional(),
  avg_evaluation_rating: z.string().optional(),
  category_sequence: z.string().optional(),
  gmt_create: z.string().optional(),
  gmt_modified: z.string().optional(),
  owner_member_seq_long: dropshipOptionalId.optional(),
}).passthrough();

export const productResultSchema = z.object({
  ae_item_base_info_dto: itemBaseInfoSchema,
  ae_item_sku_info_dtos: dropshipList(skuSchema, ['ae_item_sku_info_d_t_o', 'ae_item_sku_info_dto']),
  ae_multimedia_info_dto: multimediaSchema.optional(),
  ae_store_info: storeInfoSchema.optional(),
  ae_item_properties: dropshipList(itemPropertySchema, ['ae_item_property']).optional(),
  package_info_dto: packageInfoSchema.optional(),
  logistics_info_dto: z.object({
    ship_to_country: z.string().optional(), delivery_time: dropshipCount.optional(),
  }).passthrough().optional(),
  manufacturer_info: z.object({
    name: z.string().optional(), address: z.string().optional(), email: z.string().optional(),
    country_name: z.string().optional(), phone_prefix: z.string().optional(), phone: z.string().optional(),
  }).passthrough().optional(),
  product_id_converter_result: z.object({
    main_product_id: dropshipOptionalId.optional(),
    sub_product_id: dropshipJsonString.optional(),
  }).passthrough().optional(),
  has_whole_sale: dropshipBool.optional(),
  rsp_code: dropshipCount.optional(),
  rsp_msg: z.string().optional(),
}).passthrough();
export interface ProductGetResult extends z.infer<typeof productResultSchema> {}

/** Wholesale responses share the product schema; `has_whole_sale` marks the mode. */
export const wholesaleResultSchema = productResultSchema;
export interface ProductWholesaleGetResult extends z.infer<typeof wholesaleResultSchema> {}

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.freight.query
// Official params (all inside the `queryDeliveryReq` object):
// quantity*, shipToCountry*, productId*, provinceCode, cityCode, language*,
// locale*, selectedSkuId*, currency*, province
// ─────────────────────────────────────────────────────────────────────────────
export interface FreightQueryInput {
  productId: string; quantity: number; shipToCountry?: 'CL';
  language?: string; locale?: string; selectedSkuId?: string;
  currency?: 'USD'; provinceCode?: string; cityCode?: string; province?: string;
}

export const freightQueryInputSchema = z.object({
  productId: z.string().regex(/^[1-9]\d{5,24}$/),
  quantity: z.number().int().min(1).max(10000),
  shipToCountry: z.literal('CL').default('CL'),
  language: z.string().trim().min(2).max(16).default('es_ES'),
  locale: z.string().trim().min(2).max(16).default('es_ES'),
  selectedSkuId: z.string().regex(/^[1-9]\d*$/).max(32).optional(),
  currency: z.literal('USD').default('USD'),
  provinceCode: z.string().trim().max(32).optional(),
  cityCode: z.string().trim().max(32).optional(),
  province: z.string().trim().max(64).optional(),
}).strict();

export const freightOptionSchema = z.object({
  shipping_fee_format: z.string().optional(),
  delivery_date_desc: z.string().optional(),
  code: z.string().optional(),
  free_shipping: dropshipBool.optional(),
  max_delivery_days: dropshipCount.optional(),
  min_delivery_days: dropshipCount.optional(),
  estimated_delivery_time: z.string().optional(),
  shipping_fee_currency: z.string().optional(),
  ship_from_country: z.string().optional(),
  company: z.string().optional(),
  /** Fee: documented as minor-unit cents, but live payloads also send
   * decimal-dollar strings ("2.99") or numbers. Kept raw; the
   * service parser decides cents vs dollars. */
  shipping_fee_cent: z.union([z.string(), z.number()]).optional(),
  tracking: dropshipBool.optional(),
  mayHavePFS: dropshipBool.optional(),
  available_stock: z.string().optional(),
  guaranteed_delivery_days: z.string().optional(),
  ddpIncludeVATTax: z.string().optional(),
  free_shipping_threshold: z.string().optional(),
}).passthrough();
export type FreightOption = z.infer<typeof freightOptionSchema>;

export const freightQueryResultSchema = z.object({
  msg: z.string().optional(),
  code: dropshipCount.optional(),
  success: dropshipBool.optional(),
  delivery_options: dropshipList(freightOptionSchema, ['delivery_option', 'delivery_option_d_t_o']).optional(),
}).passthrough();
export interface FreightQueryResult extends z.infer<typeof freightQueryResultSchema> {}

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.logistics.buyer.freight.calculate
// Official params (inside `param_aeop_freight_calculate_for_buyer_d_t_o`):
// country_code*, product_id*, product_num*, send_goods_country_code*, sku_id,
// city_code, province_code, price, price_currency
// ─────────────────────────────────────────────────────────────────────────────
export interface BuyerFreightCalculateInput {
  product_id: string; product_num: number; country_code?: 'CL'; send_goods_country_code?: string;
  sku_id?: string; province_code?: string; city_code?: string; price?: string; price_currency?: 'USD';
}

export const buyerFreightInputSchema = z.object({
  product_id: z.string().regex(/^[1-9]\d{5,24}$/),
  product_num: z.number().int().min(1).max(10000),
  country_code: z.literal('CL').default('CL'),
  send_goods_country_code: z.string().trim().regex(/^[A-Z]{2}$/).default('CN'),
  sku_id: z.string().regex(/^[1-9]\d*$/).max(32).optional(),
  province_code: z.string().trim().max(32).optional(),
  city_code: z.string().trim().max(32).optional(),
  price: z.string().regex(/^\d+(?:\.\d+)?$/).max(16).optional(),
  price_currency: z.literal('USD').default('USD'),
}).strict();

export const buyerFreightOptionSchema = z.object({
  tracking_available: z.string().optional(),
  error_code: dropshipCount.optional(),
  estimated_delivery_time: z.string().optional(),
  service_name: z.string().optional(),
  freight: z.object({
    amount: dropshipAmount.optional(),
    cent: dropshipCount.optional(),
    currency_code: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();
export type BuyerFreightOption = z.infer<typeof buyerFreightOptionSchema>;

export const buyerFreightResultSchema = z.object({
  error_desc: z.string().optional(),
  success: dropshipBool.optional(),
  aeop_freight_calculate_result_for_buyer_d_t_o_list: dropshipList(
    buyerFreightOptionSchema, ['aeop_freight_calculate_result_for_buyer_d_t_o',
      'aeop_freight_calculate_result_for_buyer_dto']).optional(),
}).passthrough();
export interface BuyerFreightResult extends z.infer<typeof buyerFreightResultSchema> {}

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.image.searchV2
// Official params (inside `param0`): search_type, image_base64, currency, lang,
// sort_type, sort_order, ship_to
// ─────────────────────────────────────────────────────────────────────────────
export interface ImageSearchV2Input {
  image_base64: string; search_type?: string; currency?: 'USD'; lang?: string;
  sort_type?: string; sort_order?: string; ship_to?: 'CL';
}

export const imageSearchInputSchema = z.object({
  image_base64: z.string().min(16).max(900000),
  search_type: z.string().trim().max(32).default('image'),
  currency: z.literal('USD').default('USD'),
  lang: z.string().trim().min(2).max(16).default('es_ES'),
  sort_type: z.string().trim().max(32).optional(),
  sort_order: z.string().trim().max(16).optional(),
  ship_to: z.literal('CL').default('CL'),
}).strict();

export const imageSearchItemSchema = z.object({
  product_id: dropshipId,
  product_title: z.string().optional(),
  product_main_image_url: z.string().optional(),
  product_detail_url: z.string().optional(),
  similarity_score: z.string().optional(),
  ship_from: z.string().optional(),
  shop_id: dropshipOptionalId.optional(),
  discount: z.string().optional(),
  evaluate_rate: z.string().optional(),
  latest_volume: z.string().optional(),
  target_sale_price: dropshipAmount.optional(),
  target_sale_price_currency: z.string().optional(),
  target_original_price: dropshipAmount.optional(),
  target_original_price_currency: z.string().optional(),
  first_level_category_id: dropshipOptionalId.optional(),
  first_level_category_title: z.string().optional(),
  second_level_category_id: dropshipOptionalId.optional(),
  second_level_category_title: z.string().optional(),
}).passthrough();
export type ImageSearchItem = z.infer<typeof imageSearchItemSchema>;

export const imageSearchResultSchema = z.object({
  ret: dropshipBool.optional(),
  empty: dropshipBool.optional(),
  code: z.string().optional(),
  messages: z.string().optional(),
  data: dropshipList(imageSearchItemSchema, ['items', 'data']).optional(),
}).passthrough();
export interface ImageSearchV2Result extends z.infer<typeof imageSearchResultSchema> {}

