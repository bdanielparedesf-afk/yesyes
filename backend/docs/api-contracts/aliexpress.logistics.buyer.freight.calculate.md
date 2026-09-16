# aliexpress.logistics.buyer.freight.calculate

- title: Freight calculation interface provided for buyers
- method: GET/POST
- path: aliexpress.logistics.buyer.freight.calculate
- docId: 525
- lastModified: 2022-03-30 15:44:05

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `param_aeop_freight_calculate_for_buyer_d_t_o` | Object | required | Shipping Calculation Request Parameters |
| `param_aeop_freight_calculate_for_buyer_d_t_o.sku_id` | String | optional | skuId must be passed when calculating the choice product |
| `param_aeop_freight_calculate_for_buyer_d_t_o.city_code` | String | optional | city code |
| `param_aeop_freight_calculate_for_buyer_d_t_o.country_code` | String | required | country code |
| `param_aeop_freight_calculate_for_buyer_d_t_o.product_id` | Number | required | Product ID |
| `param_aeop_freight_calculate_for_buyer_d_t_o.product_num` | Number | required | Product count |
| `param_aeop_freight_calculate_for_buyer_d_t_o.province_code` | String | optional | Province code |
| `param_aeop_freight_calculate_for_buyer_d_t_o.send_goods_country_code` | String | required | Shipping country |
| `param_aeop_freight_calculate_for_buyer_d_t_o.price` | String | optional | commodity price |
| `param_aeop_freight_calculate_for_buyer_d_t_o.price_currency` | String | optional | commodity price currency |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | optional | result |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list` | Object[] | optional | aeopFreightCalculateResultForBuyerDTOList |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.tracking_available` | String | optional | tracking available |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.error_code` | Number | optional | errorCode |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.estimated_delivery_time` | String | optional | Estimated delivery time |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.freight` | Object | optional | freight |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.freight.amount` | String | optional | amount |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.freight.cent` | Number | optional | cent |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.freight.currency_code` | String | optional | currencyCode |
| `result.aeop_freight_calculate_result_for_buyer_d_t_o_list.service_name` | String | optional | serviceName |
| `result.error_desc` | String | optional | errorDesc |
| `result.success` | Boolean | optional | success |

## Error codes (official)

_none listed_
