# aliexpress.ds.freight.query

- title: Delivery/Freight info API
- method: GET/POST
- path: aliexpress.ds.freight.query
- docId: 1579
- lastModified: 2024-03-04 20:23:41

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `queryDeliveryReq` | Object | required | 物流查询请求 |
| `queryDeliveryReq.quantity` | Number | required | quantity for your request |
| `queryDeliveryReq.shipToCountry` | String | required | country that ships to |
| `queryDeliveryReq.productId` | String | required | product_id |
| `queryDeliveryReq.provinceCode` | String | optional | The province code, used to query shipping fees for local-to-local products. Please provide either province or provinceCode; do not provide both. |
| `queryDeliveryReq.cityCode` | String | optional | The city code. Optional. |
| `queryDeliveryReq.language` | String | required | language |
| `queryDeliveryReq.locale` | String | required | locale |
| `queryDeliveryReq.selectedSkuId` | String | required | selected sku |
| `queryDeliveryReq.currency` | String | required | currency for calculate the freight fee |
| `queryDeliveryReq.province` | String | optional | The province name, used to query shipping fees for local-to-local products. Please provide either province or provinceCode; do not provide both. |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | required | result |
| `result.msg` | String | required | error msg |
| `result.delivery_options` | Object[] | required | list of deliveryOptions |
| `result.delivery_options.shipping_fee_format` | String | required | format String shipping fee |
| `result.delivery_options.delivery_date_desc` | String | required | format delivery date estimation |
| `result.delivery_options.code` | String | required | delivery service code |
| `result.delivery_options.free_shipping` | Boolean | required | whether it is free |
| `result.delivery_options.max_delivery_days` | Number | required | estimated delivery days, max days |
| `result.delivery_options.estimated_delivery_time` | String | required | delivery estimation |
| `result.delivery_options.min_delivery_days` | Number | required | estimated delivery days, main days |
| `result.delivery_options.shipping_fee_currency` | String | required | shipping fee currency |
| `result.delivery_options.ship_from_country` | String | required | where your sku will ship from |
| `result.delivery_options.company` | String | required | shipping service company name |
| `result.delivery_options.shipping_fee_cent` | String | required | shipping fee amount in cent |
| `result.delivery_options.tracking` | Boolean | optional | is this shipping option can be tracking |
| `result.delivery_options.mayHavePFS` | Boolean | optional | if it can be platFormFreeShipping |
| `result.delivery_options.available_stock` | String | optional | available stock for sku |
| `result.delivery_options.guaranteed_delivery_days` | String | optional | it is a guaranteed days |
| `result.delivery_options.ddpIncludeVATTax` | String | optional | if price include ddp vat tax |
| `result.delivery_options.free_shipping_threshold` | String | optional | free shipping threshold |
| `result.code` | Number | required | status of this request: 200 means success |
| `result.success` | Boolean | required | true means it is success |

## Error codes (official)

```json
[
  {
    "codeDesc": "DELIVERY_NOT_AVAILABLE_TO_YOUR_ADDRESS",
    "code": "DELIVERY_NOT_AVAILABLE_TO_YOUR_ADDRESS",
    "data": [],
    "solution": "物流无法配送到指定地址",
    "id": 2204
  },
  {
    "codeDesc": "DELIVERY_INFO_EMPTY",
    "code": "DELIVERY_INFO_EMPTY",
    "data": [],
    "solution": "商品id错误，请检查商品ID",
    "id": 2204
  }
]
```
