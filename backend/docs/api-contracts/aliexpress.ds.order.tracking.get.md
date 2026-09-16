# aliexpress.ds.order.tracking.get

- title: Ds Order Tracking
- method: GET/POST
- path: aliexpress.ds.order.tracking.get
- docId: 1647
- lastModified: 2024-07-09 18:01:56

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `ae_order_id` | String | required | Order ID which you get from order.create |
| `language` | String | required | language |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | required | result |
| `result.ret` | Boolean | required | true for success |
| `result.code` | String | required | error code |
| `result.data` | Object | required | tracking list dto |
| `result.data.tracking_detail_line_list` | Object[] | required | tracking list |
| `result.data.tracking_detail_line_list.mail_no` | String | required | mail number |
| `result.data.tracking_detail_line_list.detail_node_list` | Object[] | required | tracking node |
| `result.data.tracking_detail_line_list.detail_node_list.tracking_name` | String | required | tracking node description |
| `result.data.tracking_detail_line_list.detail_node_list.time_stamp` | Number | required | timestamp |
| `result.data.tracking_detail_line_list.detail_node_list.tracking_detail_desc` | String | required | tracking node description |
| `result.data.tracking_detail_line_list.carrier_name` | String | required | carrier name |
| `result.data.tracking_detail_line_list.eta_time_stamps` | Number | required | timestamp |
| `result.data.tracking_detail_line_list.package_item_list` | Object[] | required | package item |
| `result.data.tracking_detail_line_list.package_item_list.item_id` | Number | required | item id |
| `result.data.tracking_detail_line_list.package_item_list.quantity` | Number | required | count |
| `result.data.tracking_detail_line_list.package_item_list.item_title` | String | required | item title |
| `result.data.tracking_detail_line_list.package_item_list.sku_desc` | String | required | sku desc |
| `result.data.tracking_detail_line_list.package_item_list.sku_id` | Number | optional | sku id |
| `result.data.tracking_detail_line_list.cp_name` | String | optional | carrier partner name |
| `result.data.tracking_detail_line_list.cp_website_url` | String | optional | carrier partner website url |
| `result.msg` | String | required | error message |

## Error codes (official)

```json
[
  {
    "codeDesc": "UnsupportedParamMapping",
    "code": "UnsupportedParamMapping",
    "data": [],
    "solution": "参数错误，请检查参数",
    "id": 2328
  },
  {
    "codeDesc": "TRACKING DATA NOT FOUND",
    "code": "TRACKING DATA NOT FOUND",
    "data": [],
    "solution": "物流号码错误，请检查物流号码",
    "id": 2328
  }
]
```
