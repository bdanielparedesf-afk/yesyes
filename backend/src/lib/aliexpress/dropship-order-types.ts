import { z } from 'zod';
import { dropshipAmount, dropshipBool, dropshipCount, dropshipId, dropshipList, dropshipOptionalId } from './dropship-common';

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.order.create  (MUTATING — never executed without explicit flag)
// Official params: param_place_order_request4_open_api_d_t_o*, ds_extend_request
//   logistics_address*: address*, city*, country*, province*, + optional identity/data
//   product_items[]*: product_count*, product_id*, sku_attr, logistics_service_name, order_memo
// ─────────────────────────────────────────────────────────────────────────────
export const orderAddressSchema = z.object({
  address: z.string().trim().min(1).max(256),
  address2: z.string().trim().max(256).optional(),
  city: z.string().trim().min(1).max(128),
  province: z.string().trim().min(1).max(128),
  country: z.string().trim().min(2).max(64),
  contact_person: z.string().trim().max(128).optional(),
  full_name: z.string().trim().max(160).optional(),
  mobile_no: z.string().trim().max(40).optional(),
  phone_country: z.string().trim().max(16).optional(),
  zip: z.string().trim().max(32).optional(),
  locale: z.string().trim().max(16).optional(),
  tax_number: z.string().trim().max(64).optional(),
  rut_no: z.string().trim().max(64).optional(),
  vat_no: z.string().trim().max(64).optional(),
  tax_company: z.string().trim().max(160).optional(),
  cpf: z.string().trim().max(64).optional(),
  passport_no: z.string().trim().max(64).optional(),
  passport_no_date: z.string().trim().max(32).optional(),
  passport_organization: z.string().trim().max(128).optional(),
  foreigner_passport_no: z.string().trim().max(64).optional(),
  is_foreigner: z.string().trim().max(8).optional(),
  location_tree_address_id: z.string().trim().max(64).optional(),
}).strict();

export const orderProductItemSchema = z.object({
  product_id: dropshipId,
  product_count: z.number().int().min(1).max(100000),
  sku_attr: z.string().trim().max(512).optional(),
  logistics_service_name: z.string().trim().max(128).optional(),
  order_memo: z.string().trim().max(512).optional(),
}).strict();

export const placeOrderRequestSchema = z.object({
  out_order_id: z.string().trim().max(64).optional(),
  logistics_address: orderAddressSchema,
  product_items: z.array(orderProductItemSchema).min(1).max(100),
}).strict();

export const dsExtendRequestSchema = z.object({
  promotion: z.object({
    promotion_channel_info: z.string().trim().max(128).optional(),
    promotion_activity_id: z.string().trim().max(64).optional(),
  }).strict().optional(),
  payment: z.object({
    pay_currency: z.string().trim().max(8).optional(),
    try_to_pay: z.string().trim().max(8).optional(),
  }).strict().optional(),
  trade_extra_param: z.object({
    business_model: z.string().trim().max(64).optional(),
    customize_sku_map: z.record(z.unknown()).optional(),
    nat_addr: z.string().trim().max(256).optional(),
    birthday: z.string().trim().max(32).optional(),
  }).strict().optional(),
  channel_strategy: z.string().trim().max(64).optional(),
}).strict();

export const orderCreateInputSchema = z.object({
  param_place_order_request4_open_api_d_t_o: placeOrderRequestSchema,
  ds_extend_request: dsExtendRequestSchema.optional(),
}).strict();
export type OrderCreateInput = z.infer<typeof orderCreateInputSchema>;
export type PlaceOrderRequest = z.infer<typeof placeOrderRequestSchema>;

export const orderCreateResultSchema = z.object({
  is_success: dropshipBool.optional(),
  error_code: z.string().optional(),
  error_msg: z.string().optional(),
  order_list: dropshipList(dropshipId, ['order']).optional(),
}).passthrough();
export interface OrderCreateResult extends z.infer<typeof orderCreateResultSchema> {}
// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.trade.ds.order.get
// Official params: single_order_query* { order_id* }
// ─────────────────────────────────────────────────────────────────────────────
export const orderGetInputSchema = z.object({
  order_id: z.string().regex(/^[1-9]\d{5,24}$/),
}).strict();
export interface OrderGetInput { order_id: string }

const moneySchema = z.object({
  amount: dropshipAmount.optional(),
  currency_code: z.string().optional(),
}).passthrough();

export const childOrderSchema = z.object({
  product_id: dropshipOptionalId.optional(),
  product_name: z.string().optional(),
  product_count: dropshipCount.optional(),
  sku_id: z.string().optional(),
  product_price: moneySchema.optional(),
  shipping_fee: moneySchema.optional(),
  actual_shipping_fee: moneySchema.optional(),
  sale_fee: moneySchema.optional(),
  sale_discount_fee: moneySchema.optional(),
  shipping_discount_fee: moneySchema.optional(),
  actual_fee: moneySchema.optional(),
  actual_tax_fee: moneySchema.optional(),
  already_include_tax: z.string().optional(),
  price_include_tax: z.string().optional(),
  end_reason: z.string().optional(),
  end_reason_desc: z.string().optional(),
}).passthrough();

export const orderGetResultSchema = z.object({
  order_status: z.string().optional(),
  logistics_status: z.string().optional(),
  gmt_create: z.string().optional(),
  pay_timeout_second: z.string().optional(),
  order_paidtime_string: z.string().optional(),
  order_amount: moneySchema.optional(),
  user_order_amount: moneySchema.optional(),
  child_order_list: dropshipList(childOrderSchema, ['child_order']).optional(),
  logistics_info_list: dropshipList(z.object({
    logistics_no: z.string().optional(),
    logistics_service: z.string().optional(),
  }).passthrough(), ['logistics_info']).optional(),
  store_info: z.object({
    store_id: dropshipOptionalId.optional(),
    store_name: z.string().optional(),
    store_url: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();
export interface OrderGetResult extends z.infer<typeof orderGetResultSchema> {}

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.order.tracking.get
// Official params: ae_order_id*, language*
// ─────────────────────────────────────────────────────────────────────────────
export const orderTrackingInputSchema = z.object({
  ae_order_id: z.string().regex(/^[1-9]\d{5,24}$/),
  language: z.string().trim().min(2).max(16).default('es_ES'),
}).strict();
export interface OrderTrackingInput { ae_order_id: string; language?: string }

export const trackingNodeSchema = z.object({
  tracking_name: z.string().optional(),
  time_stamp: dropshipCount.optional(),
  tracking_detail_desc: z.string().optional(),
}).passthrough();

export const trackingPackageItemSchema = z.object({
  item_id: dropshipOptionalId.optional(),
  quantity: dropshipCount.optional(),
  item_title: z.string().optional(),
  sku_desc: z.string().optional(),
  sku_id: dropshipOptionalId.optional(),
}).passthrough();

export const trackingLineSchema = z.object({
  mail_no: z.string().optional(),
  carrier_name: z.string().optional(),
  cp_name: z.string().optional(),
  cp_website_url: z.string().optional(),
  eta_time_stamps: dropshipCount.optional(),
  detail_node_list: dropshipList(trackingNodeSchema, ['detail_node']).optional(),
  package_item_list: dropshipList(trackingPackageItemSchema, ['package_item']).optional(),
}).passthrough();
export type TrackingLine = z.infer<typeof trackingLineSchema>;

export const orderTrackingResultSchema = z.object({
  ret: dropshipBool.optional(),
  code: z.string().optional(),
  msg: z.string().optional(),
  data: z.object({
    tracking_detail_line_list: dropshipList(trackingLineSchema, ['tracking_detail_line']).optional(),
  }).passthrough().optional(),
}).passthrough();
export interface OrderTrackingResult extends z.infer<typeof orderTrackingResultSchema> {}

