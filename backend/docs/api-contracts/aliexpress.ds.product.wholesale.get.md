# aliexpress.ds.product.wholesale.get

- title: product info for whole sale business
- method: GET/POST
- path: aliexpress.ds.product.wholesale.get
- docId: 1750
- lastModified: 2024-12-05 21:32:41

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `ship_to_country` | String | required | Country |
| `product_id` | Number | required | Item ID |
| `target_currency` | String | optional | Target currency |
| `target_language` | String | optional | hi de ru pt ko in en it fr zh es iw ar vi th uk ja id pl he nl tr (lowercase) or "en_US"、"ko_KR"... |
| `remove_personal_benefit` | Boolean | optional | if true, you will not get any crowd type promotion |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | required | Product search results |
| `result.logistics_info_dto` | Object | required | Logistics information |
| `result.logistics_info_dto.ship_to_country` | String | required | Goods lead time |
| `result.logistics_info_dto.delivery_time` | Number | required | Country |
| `result.ae_item_base_info_dto` | Object | required | Basic commodity information |
| `result.ae_item_base_info_dto.gmt_modified` | String | required | Item Updated Time |
| `result.ae_item_base_info_dto.product_id` | Number | required | Item ID |
| `result.ae_item_base_info_dto.subject` | String | required | The title of the product |
| `result.ae_item_base_info_dto.product_status_type` | String | required | Product status |
| `result.ae_item_base_info_dto.gmt_create` | String | required | Commodity creation time |
| `result.ae_item_base_info_dto.mobile_detail` | String | required | Mobile detailed description |
| `result.ae_item_base_info_dto.avg_evaluation_rating` | String | required | Average rating stars, 1-5 stars |
| `result.ae_item_base_info_dto.ws_display` | String | required | Reasons for removal of goods |
| `result.ae_item_base_info_dto.evaluation_count` | String | required | Evaluation number |
| `result.ae_item_base_info_dto.ws_offline_date` | String | required | The date the product was removed from the shelf |
| `result.ae_item_base_info_dto.owner_member_seq_long` | Number | required | Seller's master account ID |
| `result.ae_item_base_info_dto.detail` | String | required | Commodity detailed description |
| `result.ae_item_base_info_dto.currency_code` | String | required | The currency unit of the commodity. U.S. Dollar: USD, Ruble: RUB |
| `result.ae_item_base_info_dto.category_id` | Number | required | ID of the category of the product |
| `result.ae_item_base_info_dto.sales_count` | String | optional | Sales volume of product |
| `result.ae_item_base_info_dto.category_sequence` | String | optional | category sequence |
| `result.ae_item_properties` | Object[] | required | Attribute information |
| `result.ae_item_properties.attr_value_start` | String | required | Interval attribute start value |
| `result.ae_item_properties.attr_value_id` | Number | required | Attribute ID |
| `result.ae_item_properties.attr_value_end` | String | required | End value of interval attribute |
| `result.ae_item_properties.attr_value` | String | required | Attribute value |
| `result.ae_item_properties.attr_value_unit` | String | required | Attribute unit |
| `result.ae_item_properties.attr_name` | String | required | Attribute name |
| `result.ae_item_properties.attr_name_id` | Number | required | Attribute ID |
| `result.ae_item_sku_info_dtos` | Object[] | required | SKU information |
| `result.ae_item_sku_info_dtos.ipm_sku_stock` | Number | required | The actual saleable inventory attribute of SKU is ipmSkuStock. The reasonable value range of this attribute value is 0~999999. If the product has SKU, please make sure that at least one SKU is in stock, that is, the value of ipmSkuStock is 1~999999. The range of the inventory value of the entire product latitude is 1~999999. If the skuStock attribute is set at the same time, the system will give priority to the ipmSkuStock attribute; if the ipmSkuStock attribute is not set, the system will set the inventory according to the skuStock attribute, true means 999, false means 0. |
| `result.ae_item_sku_info_dtos.offer_bulk_sale_price` | String | required | SKU bulk discount price |
| `result.ae_item_sku_info_dtos.sku_available_stock` | Number | required | SKU inventory |
| `result.ae_item_sku_info_dtos.sku_bulk_order` | Number | required | Minimum number of batches |
| `result.ae_item_sku_info_dtos.sku_stock` | Boolean | required | SKU inventory, the data format is true if stock is available, false if no stock is available; at least one sku record is available. |
| `result.ae_item_sku_info_dtos.sku_price` | String | required | Origin SKU price. Value range: 0.01-100000; Unit: USD. Such as: 200.07, which means: 200 US dollars 7 points. Need to be in the correct price range. |
| `result.ae_item_sku_info_dtos.offer_sale_price` | String | required | SKU discount price |
| `result.ae_item_sku_info_dtos.id` | String | required | sku attribute  unique key |
| `result.ae_item_sku_info_dtos.ae_sku_property_dtos` | Object[] | required | SKU attribute object |
| `result.ae_item_sku_info_dtos.ae_sku_property_dtos.sku_property_value` | String | required | Attribute value |
| `result.ae_item_sku_info_dtos.ae_sku_property_dtos.property_value_id` | Number | required | Custom id |
| `result.ae_item_sku_info_dtos.ae_sku_property_dtos.sku_property_name` | String | required | Attribute name |
| `result.ae_item_sku_info_dtos.ae_sku_property_dtos.sku_property_id` | Number | required | Attribute ID |
| `result.ae_item_sku_info_dtos.ae_sku_property_dtos.property_value_definition_name` | String | required | Custom name |
| `result.ae_item_sku_info_dtos.ae_sku_property_dtos.sku_image` | String | required | SKU pictures |
| `result.ae_item_sku_info_dtos.barcode` | String | required | Commodity barcode |
| `result.ae_item_sku_info_dtos.currency_code` | String | required | The currency unit of the product. U.S. Dollar: USD, Ruble: RUB |
| `result.ae_item_sku_info_dtos.sku_code` | String | required | SKU merchant code. Format: single-byte alphanumeric characters, length 20, excluding spaces greater than and less than signs. If the user only fills in the retail price (productprice) and product code, a complete SKU record needs to be generated and submitted, otherwise the product code cannot be saved. The system will think that only the retail price has been submitted, but there is no SKU, resulting in unsaved product editing. |
| `result.ae_item_sku_info_dtos.sku_id` | String | optional | sku id, can be used for aliexpress.logistics.buyer.freight.calculate request |
| `result.ae_item_sku_info_dtos.sku_attr` | String | optional | sku attribute  unique key in new field name |
| `result.ae_item_sku_info_dtos.ean_code` | String | optional | eanCode |
| `result.ae_item_sku_info_dtos.price_include_tax` | Boolean | optional | if the price include tax |
| `result.ae_item_sku_info_dtos.wholesale_price_tiers` | Object[] | optional | display when the item has wholesale price |
| `result.ae_item_sku_info_dtos.wholesale_price_tiers.min_quantity` | String | optional | threshold quantity for wholesale |
| `result.ae_item_sku_info_dtos.wholesale_price_tiers.discount` | String | optional | discount rate |
| `result.ae_item_sku_info_dtos.wholesale_price_tiers.wholesale_price` | String | optional | whole price |
| `result.ae_item_sku_info_dtos.buy_amount_limit_set_by_promotion` | String | optional | promotion buy limit |
| `result.ae_item_sku_info_dtos.limit_strategy` | String | optional | the limit strategy after you reach promotion limit |
| `result.ae_multimedia_info_dto` | Object | required | Multimedia information |
| `result.ae_multimedia_info_dto.ae_video_dtos` | Object[] | required | Video information |
| `result.ae_multimedia_info_dto.ae_video_dtos.poster_url` | String | required | The URL of the video cover image |
| `result.ae_multimedia_info_dto.ae_video_dtos.media_status` | String | required | Video status |
| `result.ae_multimedia_info_dto.ae_video_dtos.ali_member_id` | Number | required | Seller's master account ID |
| `result.ae_multimedia_info_dto.ae_video_dtos.media_type` | String | required | Type of video |
| `result.ae_multimedia_info_dto.ae_video_dtos.media_id` | Number | required | Video ID |
| `result.ae_multimedia_info_dto.ae_video_dtos.media_url` | String | optional | media url |
| `result.ae_multimedia_info_dto.image_urls` | String | required | List of main images of the product |
| `result.package_info_dto` | Object | required | Package information |
| `result.package_info_dto.base_unit` | Number | required | Number of basic products for custom weighing |
| `result.package_info_dto.package_height` | Number | required | Product height |
| `result.package_info_dto.gross_weight` | String | required | The gross weight of the product |
| `result.package_info_dto.package_length` | Number | required | The length of the product |
| `result.package_info_dto.package_width` | Number | required | Product width |
| `result.package_info_dto.product_unit` | Number | required | Unit of commodity |
| `result.package_info_dto.package_type` | Boolean | required | Type of packaging |
| `result.ae_store_info` | Object | required | Store Information |
| `result.ae_store_info.item_as_described_rating` | String | required | Product description, 1-5 stars |
| `result.ae_store_info.communication_rating` | String | required | Seller service, 1-5 stars |
| `result.ae_store_info.shipping_speed_rating` | String | required | Logistics, 1-5 stars |
| `result.ae_store_info.store_name` | String | required | Shop name |
| `result.ae_store_info.store_id` | Number | required | Store ID |
| `result.ae_store_info.store_country_code` | String | optional | store country code, can be used as 'ship from' country of the sku |
| `result.product_id_converter_result` | Object | optional | product id converter result |
| `result.product_id_converter_result.main_product_id` | Number | optional | main productId |
| `result.product_id_converter_result.sub_product_id` | Object | optional | sub productId |
| `result.has_whole_sale` | Boolean | optional | has wholesale price |
| `rsp_msg` | String | required | result message |
| `rsp_code` | Number | required | result code |

## Error codes (official)

```json
[
  {
    "codeDesc": "All SKU Unsaleable",
    "code": "All SKU Unsaleable",
    "data": [],
    "solution": "商品不可售，请更换商品。",
    "id": 2560
  },
  {
    "codeDesc": "ITEM_ID_NOT_FOUND",
    "code": "ITEM_ID_NOT_FOUND",
    "data": [],
    "solution": "商品未找到，请检查商品id",
    "id": 2560
  }
]
```
