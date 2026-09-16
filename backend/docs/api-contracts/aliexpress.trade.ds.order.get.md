# aliexpress.trade.ds.order.get

- title: buyer query order details
- method: GET/POST
- path: aliexpress.trade.ds.order.get
- docId: 524
- lastModified: 2022-03-30 15:43:59

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `single_order_query` | Object | required | order query conditions |
| `single_order_query.order_id` | Number | required | order id |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | optional | order information |
| `result.user_order_amount` | Object | optional | order amount in user's pay currency |
| `result.user_order_amount.amount` | String | optional | amount |
| `result.user_order_amount.currency_code` | String | optional | currency |
| `result.pay_timeout_second` | String | optional | seconds for pay expiration, from order created |
| `result.order_paidtime_string` | String | optional | order paid time |
| `result.gmt_create` | String | optional | order creation time |
| `result.order_status` | String | optional | order status |
| `result.logistics_status` | String | optional | logistics status |
| `result.order_amount` | Object | optional | order amount |
| `result.order_amount.amount` | String | optional | amount |
| `result.order_amount.currency_code` | String | optional | currency code |
| `result.child_order_list` | Object[] | optional | child order list |
| `result.child_order_list.actual_tax_fee` | Object | optional | tax amount in user's pay currency |
| `result.child_order_list.actual_tax_fee.amount` | String | optional | amount |
| `result.child_order_list.actual_tax_fee.currency_code` | String | optional | USD |
| `result.child_order_list.actual_shipping_fee` | Object | optional | actual shipping fee = shippingfee - shippingdiscount |
| `result.child_order_list.actual_shipping_fee.amount` | String | optional | fee amount |
| `result.child_order_list.actual_shipping_fee.currency_code` | String | optional | currency |
| `result.child_order_list.already_include_tax` | String | optional | does the product fee already include tax |
| `result.child_order_list.shipping_fee` | Object | optional | shipping fee |
| `result.child_order_list.shipping_fee.amount` | String | optional | amount |
| `result.child_order_list.shipping_fee.currency_code` | String | optional | currency |
| `result.child_order_list.sale_discount_fee` | Object | optional | sale discount |
| `result.child_order_list.sale_discount_fee.amount` | String | optional | amount |
| `result.child_order_list.sale_discount_fee.currency_code` | String | optional | currency |
| `result.child_order_list.sale_fee` | Object | optional | sale fee |
| `result.child_order_list.sale_fee.amount` | String | optional | amount |
| `result.child_order_list.sale_fee.currency_code` | String | optional | currency |
| `result.child_order_list.actual_fee` | Object | optional | actual fee = sale fee - sale discount + actual shipping |
| `result.child_order_list.actual_fee.amount` | String | optional | amount |
| `result.child_order_list.actual_fee.currency_code` | String | optional | currency |
| `result.child_order_list.shipping_discount_fee` | Object | optional | shipping discount |
| `result.child_order_list.shipping_discount_fee.amount` | String | optional | amount |
| `result.child_order_list.shipping_discount_fee.currency_code` | String | optional | currency |
| `result.child_order_list.end_reason` | String | optional | order's end reason, like CANCELED |
| `result.child_order_list.sku_id` | String | optional | SKU id |
| `result.child_order_list.price_include_tax` | String | optional | if price include tax |
| `result.child_order_list.end_reason_desc` | String | optional | description of end reason |
| `result.child_order_list.product_id` | Number | optional | product id |
| `result.child_order_list.product_price` | Object | optional | product price |
| `result.child_order_list.product_price.amount` | String | optional | amount |
| `result.child_order_list.product_price.currency_code` | String | optional | currency code |
| `result.child_order_list.product_name` | String | optional | product name |
| `result.child_order_list.product_count` | Number | optional | number of products |
| `result.logistics_info_list` | Object[] | optional | order logistics information list |
| `result.logistics_info_list.logistics_no` | String | optional | logistics tracking number |
| `result.logistics_info_list.logistics_service` | String | optional | logistics service |
| `result.store_info` | Object | optional | store Information |
| `result.store_info.store_id` | Number | optional | store id |
| `result.store_info.store_name` | String | optional | store name |
| `result.store_info.store_url` | String | optional | store url |

## Error codes (official)

```json
[
  {
    "codeDesc": "isv.insufficient-permission",
    "code": "isv.insufficient-permission",
    "data": [],
    "solution": "权限不足，请检查参数",
    "id": 96
  },
  {
    "codeDesc": "isp.service-unavailable",
    "code": "isp.service-unavailable",
    "data": [],
    "solution": "服务超时，请重试",
    "id": 96
  },
  {
    "codeDesc": "isv.invalid-authorization",
    "code": "isv.invalid-authorization",
    "data": [],
    "solution": "访问非本人数据，请检查参数",
    "id": 96
  },
  {
    "codeDesc": "InternalError",
    "code": "InternalError",
    "data": [],
    "solution": "系统错误，需要联系技术支持处理",
    "id": 96
  }
]
```
