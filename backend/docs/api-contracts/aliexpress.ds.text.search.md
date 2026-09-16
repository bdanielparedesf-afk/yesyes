# aliexpress.ds.text.search

- title: 代发商搜索
- method: GET/POST
- path: aliexpress.ds.text.search
- docId: 1695
- lastModified: 2024-08-29 16:54:29

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `keyWord` | String | optional | 搜索关键词 |
| `local` | String | required | 语言 |
| `countryCode` | String | required | 目的国家码 |
| `categoryId` | Number | optional | 类目id |
| `sortBy` | String | optional | accept value: min_primin_price,asc min_price,desc orders,asc orders,desc comments,asc comments,descce,asc min_price,desc orders,asc orders,desc comments,asc comments,desc |
| `pageSize` | Number | optional | page size |
| `pageIndex` | Number | optional | page index |
| `currency` | String | required | 货币单位 |
| `searchExtend` | Object[] | optional | search extend |
| `searchExtend.searchKey` | String | optional | search key |
| `searchExtend.searchValue` | String | optional | search value |
| `searchExtend.max` | String | optional | max |
| `searchExtend.min` | String | optional | min |
| `selectionName` | String | optional | text search within specific selection |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `code` | String | optional | code |
| `msg` | String | optional | message |
| `data` | Object | optional | data |
| `data.totalCount` | Number | optional | total |
| `data.pageIndex` | Number | optional | page index |
| `data.pageSize` | Number | optional | page size |
| `data.products` | Object[] | optional | products |
| `data.products.salePriceFormat` | String | optional | 折后价 |
| `data.products.itemUrl` | String | optional | 商品链接 |
| `data.products.orders` | String | optional | 订单数（近180天） |
| `data.products.score` | String | optional | 评分 |
| `data.products.title` | String | optional | 标题 |
| `data.products.itemMainPic` | String | optional | 主图链接 |
| `data.products.cateId` | String | optional | 类目id |
| `data.products.originalPriceFormat` | String | optional | 商品原价 |
| `data.products.originMinPrice` | String | optional | 折后价detail |
| `data.products.itemId` | String | optional | 商品id |
| `data.products.originalPrice` | String | optional | originalPrice |
| `data.products.originalPriceCurrency` | String | optional | originalPriceCurrency |
| `data.products.salePrice` | String | optional | salePrice |
| `data.products.salePriceCurrency` | String | optional | salePriceCurrency |
| `data.products.targetOriginalPrice` | String | optional | targetOriginalPrice |
| `data.products.targetOriginalPriceCurrency` | String | optional | targetOriginalPriceCurrency |
| `data.products.targetSalePrice` | String | optional | targetSalePrice |
| `data.products.discount` | String | optional | discount |
| `data.products.productVideoUrl` | String | optional | productVideoUrl |
| `data.products.evaluateRate` | String | optional | evaluateRate |
| `data.products.type` | String | optional | "search"/"recommend" |

## Error codes (official)

```json
[
  {
    "codeDesc": "IllegalAccessToken",
    "code": "IllegalAccessToken",
    "data": [],
    "solution": "accesstoken错误，请检查accesstoken",
    "id": 2464
  }
]
```
