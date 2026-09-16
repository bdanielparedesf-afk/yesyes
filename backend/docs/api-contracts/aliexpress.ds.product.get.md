# aliexpress.ds.product.get

- title: product info query for ds
- method: GET/POST
- path: aliexpress.ds.product.get
- docId: 10484
- lastModified: 2026-09-17 04:22:08

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `ship_to_country` | String | required | Country |
| `product_id` | Number | required | Item ID |
| `target_currency` | String | optional | Target currency |
| `target_language` | String | optional | hi de ru pt ko in en it fr zh es iw ar vi th uk ja id pl he nl tr (lowercase) or "en_US"、"ko_KR"... |
| `remove_personal_benefit` | Boolean | optional | if true, you will not get any crowd type promotion |
| `biz_model` | String | optional | ds营销价格，请联系DS业务获取使用方法 |
| `province_code` | String | optional | provice |
| `city_code` | String | optional | city |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `rsp_msg` | String | required | result message |
| `rsp_code` | Number | required | result code |
| `result` | Object | required | Product search results |
| `result.ae_item_properties` | Object[] | required | Attribute information |
| `result.ae_item_properties.attr_value_start` | String | required | Interval attribute start value |
| `result.ae_item_properties.attr_value_id` | Number | required | Attribute ID |
| `result.ae_item_properties.attr_value_end` | String | required | End value of interval attribute |
| `result.ae_item_properties.attr_value` | String | required | Attribute value |
| `result.ae_item_properties.attr_value_unit` | String | required | Attribute unit |
| `result.ae_item_properties.attr_name` | String | required | Attribute name |
| `result.ae_item_properties.attr_name_id` | Number | required | Attribute ID |
| `result.ae_item_sku_info_dtos` | Object[] | required | SKU information |
| `result.ae_item_sku_info_dtos.offer_bulk_sale_price` | String | required | SKU bulk discount price |
| `result.ae_item_sku_info_dtos.sku_available_stock` | Number | required | SKU inventory |
| `result.ae_item_sku_info_dtos.sku_bulk_order` | Number | required | Minimum number of batches |
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
| `result.ae_item_sku_info_dtos.tax_currency_code` | String | optional | currency code of tax |
| `result.ae_item_sku_info_dtos.tax_amount` | String | optional | tax amount |
| `result.ae_item_sku_info_dtos.estimated_import_charges` | String | optional | Products from the People's Republic of China (which include products from Hong Kong) entering the U.S. for consumption will be subject to all applicable import charges (duties, taxes, fees, exactions, etc.) according to the currently effective regulatory requirements in the U.S. To ensure compliance with such requriements, these applicable import charges may be remitted to U.S. regulatory authorities on your behalf. |
| `result.ae_item_sku_info_dtos.channel_discount_price` | String | optional | ds channel price |
| `result.ae_item_sku_info_dtos.sl_related_skuId` | Number | optional | super link skuId |
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
| `result.manufacturer_info` | Object | optional | manufacturer info |
| `result.manufacturer_info.name` | String | optional | name |
| `result.manufacturer_info.address` | String | optional | address |
| `result.manufacturer_info.email` | String | optional | email |
| `result.manufacturer_info.country_name` | String | optional | country_name |
| `result.manufacturer_info.phone_prefix` | String | optional | phone_prefix |
| `result.manufacturer_info.phone` | String | optional | phone |
| `result.logistics_info_dto` | Object | required | Logistics information |
| `result.logistics_info_dto.ship_to_country` | String | required | Country |
| `result.logistics_info_dto.delivery_time` | Number | required | Goods lead time |
| `result.ae_item_base_info_dto` | Object | required | Basic commodity information |
| `result.ae_item_base_info_dto.evaluation_count` | String | required | Evaluation number |
| `result.ae_item_base_info_dto.owner_member_seq_long` | Number | required | Seller's master account ID |
| `result.ae_item_base_info_dto.detail` | String | required | Commodity detailed description |
| `result.ae_item_base_info_dto.currency_code` | String | required | The currency unit of the commodity. U.S. Dollar: USD, Ruble: RUB |
| `result.ae_item_base_info_dto.category_id` | Number | required | ID of the category of the product |
| `result.ae_item_base_info_dto.sales_count` | String | optional | Sales volume of product |
| `result.ae_item_base_info_dto.category_sequence` | String | optional | category sequence |
| `result.ae_item_base_info_dto.separated_listing` | Boolean | optional | is separated per sku |
| `result.ae_item_base_info_dto.sl_product` | Boolean | optional | is super link product |
| `result.ae_item_base_info_dto.sl_related_product_id` | Number | optional | super link product id |
| `result.ae_item_base_info_dto.gmt_modified` | String | required | Item Updated Time |
| `result.ae_item_base_info_dto.product_id` | Number | required | Item ID |
| `result.ae_item_base_info_dto.subject` | String | required | The title of the product |
| `result.ae_item_base_info_dto.product_status_type` | String | required | Product status |
| `result.ae_item_base_info_dto.gmt_create` | String | required | Commodity creation time |
| `result.ae_item_base_info_dto.mobile_detail` | String | required | Mobile detailed description |
| `result.ae_item_base_info_dto.avg_evaluation_rating` | String | required | Average rating stars, 1-5 stars |

## Error codes (official)

```json
[
  {
    "codeDesc": "Item is not allowed to this country",
    "code": "Item is not allowed to this country",
    "data": [],
    "solution": "商品在该国家禁售，请更换国家或者商品",
    "id": 1
  },
  {
    "codeDesc": "ITEM_ID_NOT_FOUND",
    "code": "ITEM_ID_NOT_FOUND",
    "data": [],
    "solution": "商品itemid错误，请检查itemid",
    "id": 1
  },
  {
    "codeDesc": "System Error",
    "code": "System Error",
    "data": [],
    "solution": "系统错误，需要联系技术支持处理",
    "id": 1
  }
]
```
