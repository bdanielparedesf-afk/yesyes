# aliexpress.ds.order.create

- title: 速卖通订单创建和支付接口
- method: GET/POST
- path: aliexpress.ds.order.create
- docId: 1615
- lastModified: 2024-04-29 13:36:13

## Request parameters (official)

| Parameter | Type | Presence | Description |
|---|---|---|---|
| `ds_extend_request` | Object | optional | DS ExtendParam |
| `ds_extend_request.promotion` | Object | optional | promotionCode |
| `ds_extend_request.promotion.promotion_channel_info` | String | optional | promotionChannelInfo |
| `ds_extend_request.promotion.promotion_activity_id` | String | optional | promotion id from coupon query API's field "dsCouponId" |
| `ds_extend_request.payment` | Object | optional | {"payment":{"pay_currency":"xxx"}} |
| `ds_extend_request.payment.pay_currency` | String | optional | USD |
| `ds_extend_request.payment.try_to_pay` | String | optional | Please auth your account as DS Before set it true |
| `ds_extend_request.trade_extra_param` | Object | optional | whether it is wholesale |
| `ds_extend_request.trade_extra_param.business_model` | String | optional | "wholesale" for wholesale model, "retail" for retail model |
| `ds_extend_request.trade_extra_param.customize_sku_map` | Object | optional | key is sku_id, value is customize_id |
| `ds_extend_request.trade_extra_param.nat_addr` | String | optional | SA natAddr |
| `ds_extend_request.trade_extra_param.birthday` | String | optional | 收件人生日，当收货国家为巴西（BR）时，此字段为必填项。 格式： ddMMyyyy（日-月-年，8位数字，无分隔符）。 示例： 01022026 代表 2026年2月1日。 |
| `ds_extend_request.channel_strategy` | String | optional | channel_strategy |
| `param_place_order_request4_open_api_d_t_o` | Object | required | specific order parameters |
| `param_place_order_request4_open_api_d_t_o.out_order_id` | String | optional | outer order id, used for idempotent checkout |
| `param_place_order_request4_open_api_d_t_o.logistics_address` | Object | required | logistic address information |
| `param_place_order_request4_open_api_d_t_o.logistics_address.address` | String | required | address information |
| `param_place_order_request4_open_api_d_t_o.logistics_address.address2` | String | optional | address extension information |
| `param_place_order_request4_open_api_d_t_o.logistics_address.city` | String | required | city |
| `param_place_order_request4_open_api_d_t_o.logistics_address.contact_person` | String | optional | contact person |
| `param_place_order_request4_open_api_d_t_o.logistics_address.country` | String | required | receiver country |
| `param_place_order_request4_open_api_d_t_o.logistics_address.cpf` | String | optional | taxpayer identification number |
| `param_place_order_request4_open_api_d_t_o.logistics_address.full_name` | String | optional | receiver full name |
| `param_place_order_request4_open_api_d_t_o.logistics_address.locale` | String | optional | internationalization locale |
| `param_place_order_request4_open_api_d_t_o.logistics_address.mobile_no` | String | optional | mobile phone number |
| `param_place_order_request4_open_api_d_t_o.logistics_address.passport_no` | String | optional | passport number |
| `param_place_order_request4_open_api_d_t_o.logistics_address.passport_no_date` | String | optional | passport expiry date |
| `param_place_order_request4_open_api_d_t_o.logistics_address.passport_organization` | String | optional | passport issuing agency |
| `param_place_order_request4_open_api_d_t_o.logistics_address.phone_country` | String | optional | country code of the phone |
| `param_place_order_request4_open_api_d_t_o.logistics_address.province` | String | required | province |
| `param_place_order_request4_open_api_d_t_o.logistics_address.tax_number` | String | optional | tax number |
| `param_place_order_request4_open_api_d_t_o.logistics_address.zip` | String | optional | zip code |
| `param_place_order_request4_open_api_d_t_o.logistics_address.rut_no` | String | optional | Chile tax number (not used) |
| `param_place_order_request4_open_api_d_t_o.logistics_address.foreigner_passport_no` | String | optional | foreign tax number (registration card number or passport number is required for Korean foreigners) |
| `param_place_order_request4_open_api_d_t_o.logistics_address.is_foreigner` | String | optional | whether it is a foreigner |
| `param_place_order_request4_open_api_d_t_o.logistics_address.vat_no` | String | optional | vat tax number |
| `param_place_order_request4_open_api_d_t_o.logistics_address.tax_company` | String | optional | company name |
| `param_place_order_request4_open_api_d_t_o.logistics_address.location_tree_address_id` | String | optional | location tree address id |
| `param_place_order_request4_open_api_d_t_o.product_items` | Object[] | required | product attributes |
| `param_place_order_request4_open_api_d_t_o.product_items.product_count` | Number | required | product count |
| `param_place_order_request4_open_api_d_t_o.product_items.product_id` | Number | required | product id |
| `param_place_order_request4_open_api_d_t_o.product_items.sku_attr` | String | optional | product sku |
| `param_place_order_request4_open_api_d_t_o.product_items.logistics_service_name` | String | optional | logistics service name |
| `param_place_order_request4_open_api_d_t_o.product_items.order_memo` | String | optional | user Comments |

## Response fields (official)

| Field | Type | Presence | Description |
|---|---|---|---|
| `result` | Object | optional | result |
| `result.error_code` | String | optional | errorCode |
| `result.error_msg` | String | optional | errorMsg |
| `result.order_list` | Number[] | optional | orderList |
| `result.is_success` | Boolean | optional | success |

## Error codes (official)

```json
[
  {
    "codeDesc": "B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL",
    "code": "B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL",
    "data": [],
    "solution": "地址错误，请检查地址",
    "id": 2240
  },
  {
    "codeDesc": "B_DROPSHIPPER_DELIVERY_ADDRESS_CPF_CN_INVALID",
    "code": "B_DROPSHIPPER_DELIVERY_ADDRESS_CPF_CN_INVALID",
    "data": [],
    "solution": "CPF错误，请检查CPF",
    "id": 2240
  },
  {
    "codeDesc": "B_DROPSHIPPER_DELIVERY_ADDRESS_CPF_NOT_MATCH",
    "code": "B_DROPSHIPPER_DELIVERY_ADDRESS_CPF_NOT_MATCH",
    "data": [],
    "solution": "CPF错误，请检查CPF",
    "id": 2240
  },
  {
    "codeDesc": "BLACKLIST_BUYER_IN_LIST",
    "code": "BLACKLIST_BUYER_IN_LIST",
    "data": [],
    "solution": "用户ID状态异常，请尝试更换用户下单",
    "id": 2240
  },
  {
    "codeDesc": "USER_ACCOUNT_DISABLED",
    "code": "USER_ACCOUNT_DISABLED",
    "data": [],
    "solution": "用户ID状态异常，请尝试更换用户下单",
    "id": 2240
  },
  {
    "codeDesc": "PRICE_PAY_CURRENCY_ERROR",
    "code": "PRICE_PAY_CURRENCY_ERROR",
    "data": [],
    "solution": "产品应申报为同一货币。",
    "id": 2240
  },
  {
    "codeDesc": "DELIVERY_METHOD_NOT_EXIST",
    "code": "DELIVERY_METHOD_NOT_EXIST",
    "data": [],
    "solution": "请填写有效的送货方式（您可以使用 aliexpress.freight.query 检查）",
    "id": 2240
  },
  {
    "codeDesc": "INVENTORY_HOLD_ERROR",
    "code": "INVENTORY_HOLD_ERROR",
    "data": [],
    "solution": "库存不足或系统错误。",
    "id": 2240
  },
  {
    "codeDesc": "REPEATED_ORDER_ERROR",
    "code": "REPEATED_ORDER_ERROR",
    "data": [],
    "solution": "重复下单，请重试",
    "id": 2240
  },
  {
    "codeDesc": "ERROR_WHEN_BUILD_FOR_PLACE_ORDER",
    "code": "ERROR_WHEN_BUILD_FOR_PLACE_ORDER",
    "data": [],
    "solution": "兜底错误，需要联系技术支持",
    "id": 2240
  },
  {
    "codeDesc": "A001_ORDER_CANNOT_BE_PLACED",
    "code": "A001_ORDER_CANNOT_BE_PLACED",
    "data": [],
    "solution": "无法下订单，需要联系技术处理",
    "id": 2240
  },
  {
    "codeDesc": "A002_INVALID_ZONE",
    "code": "A002_INVALID_ZONE",
    "data": [],
    "solution": "无法下订单，需要联系技术处理",
    "id": 2240
  },
  {
    "codeDesc": "A003_SUSPICIOUS_BUYER",
    "code": "A003_SUSPICIOUS_BUYER",
    "data": [],
    "solution": "无法下订单，需要联系技术处理",
    "id": 2240
  },
  {
    "codeDesc": "A004_CANNOT_USER_COUPON",
    "code": "A004_CANNOT_USER_COUPON",
    "data": [],
    "solution": "无法下订单，需要联系技术处理",
    "id": 2240
  },
  {
    "codeDesc": "A005_INVALID_COUNTRIES",
    "code": "A005_INVALID_COUNTRIES",
    "data": [],
    "solution": "无法下订单，需要联系技术处理",
    "id": 2240
  },
  {
    "codeDesc": "A006_INVALID_ACCOUNT_INFO",
    "code": "A006_INVALID_ACCOUNT_INFO",
    "data": [],
    "solution": "无法下订单，需要联系技术处理",
    "id": 2240
  }
]
```
