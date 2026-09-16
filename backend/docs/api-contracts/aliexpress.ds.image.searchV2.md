# aliexpress.ds.image.searchV2

- title: ae dropshiper image search v2
- method: GET/POST
- path: aliexpress.ds.image.searchV2
- docId: 1748
- lastModified: 2024-12-04 19:26:33

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `param0` | Object | optional | param0 |
| `param0.search_type` | String | optional | image search type(same/similar) |
| `param0.image_base64` | String | optional | image encoded using base64 |
| `param0.currency` | String | optional | currency |
| `param0.lang` | String | optional | language |
| `param0.sort_type` | String | optional | sort type(price/orders) |
| `param0.sort_order` | String | optional | sort order(asc/desc) |
| `param0.ship_to` | String | optional | ship to country |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | required | result |
| `result.messages` | String | required | message |
| `result.empty` | Boolean | required | empty |
| `result.ret` | Boolean | required | ret |
| `result.code` | String | required | code |
| `result.data` | Object[] | required | data |
| `result.data.product_main_image_url` | String | required | product_main_image_url |
| `result.data.target_original_price_currency` | String | required | target_original_price_currency |
| `result.data.evaluate_rate` | String | required | evaluate_rate |
| `result.data.target_original_price` | String | required | target_original_price |
| `result.data.shop_id` | Number | required | shop_id |
| `result.data.second_level_category_title` | String | required | second_level_category_title |
| `result.data.ship_from` | String | optional | US |
| `result.data.similarity_score` | String | optional | similarity score |
| `result.data.first_level_category_id` | String | required | first_level_category_id |
| `result.data.product_id` | String | required | product_id |
| `result.data.target_sale_price_currency` | String | required | target_sale_price_currency |
| `result.data.discount` | String | required | discount |
| `result.data.second_level_category_id` | String | required | second_level_category_id |
| `result.data.latest_volume` | String | required | latest_volume |
| `result.data.product_title` | String | required | product_title |
| `result.data.product_detail_url` | String | required | product_detail_url |
| `result.data.first_level_category_title` | String | required | first_level_category_title |
| `result.data.target_sale_price` | String | required | target_sale_price |

## Error codes (official)

_none listed_
