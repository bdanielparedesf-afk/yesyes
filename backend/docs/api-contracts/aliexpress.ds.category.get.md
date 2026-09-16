# aliexpress.ds.category.get

- title: AE类目信息查询
- method: GET/POST
- path: aliexpress.ds.category.get
- docId: 1304
- lastModified: 2023-06-19 12:23:38

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `categoryId` | String | optional | categoryId |
| `language` | String | optional | language |
| `app_signature` | String | optional | signature |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `resp_result` | Object | optional | Respond result |
| `resp_result.resp_code` | Number | optional | Respond status code |
| `resp_result.resp_msg` | String | optional | Description of the respond status code |
| `resp_result.result` | Object | optional | Detail of the respond |
| `resp_result.result.categories` | Object[] | optional | category |
| `resp_result.result.categories.category_id` | Number | optional | Category ID |
| `resp_result.result.categories.category_name` | String | optional | Category Name |
| `resp_result.result.categories.parent_category_id` | Number | optional | Parent category ID |
| `resp_result.result.total_result_count` | Number | optional | Respond result count |

## Error codes (official)

```json
[
  {
    "codeDesc": "UnsupportedParamMapping",
    "code": "UnsupportedParamMapping",
    "data": [],
    "solution": "不支持的参数，请检查参数",
    "id": 1782
  }
]
```
