# aliexpress.ds.feed.itemids.get

- title: 根据 feedname 返回 itemIds
- method: GET/POST
- path: aliexpress.ds.feed.itemids.get
- docId: 1649
- lastModified: 2024-07-18 14:21:30

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `page_size` | Number | optional | number of each page |
| `category_id` | String | optional | first level category id, you can get from category query |
| `feed_name` | String | required | query api ‘aliexpress.ds.feedname.get’ |
| `search_id` | String | optional | — |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | required | result object |
| `result.products` | Number[] | required | item id list |
| `result.search_id` | String | optional | search id, put it in the next request |
| `result.total` | Number | optional | total item id left |
| `rsp_msg` | String | required | result msg |
| `rsp_code` | Number | required | result code |
| `ret` | Boolean | optional | true is success, false for fail |

## Error codes (official)

_none listed_
