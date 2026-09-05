# Base de Datos - YESYES

## Motor
PostgreSQL

## ORM
Prisma

## Esquema principal

### User
- id (UUID)
- email
- password (hash)
- name
- lastName
- phone
- emailVerified
- googleId
- avatar
- role (enum: SUPER_ADMIN, ADMIN, MANAGER, SUPPORT, PRODUCT_MANAGER, CUSTOMER)
- createdAt
- updatedAt

### Product
- id (UUID)
- name
- slug (único)
- description
- images (json)
- video (url, nullable)
- categoryId (UUID)
- tags (json)
- sku
- supplier (enum: ALIEXPRESS, TEMU, AMAZON)
- supplierProductId
- supplierUrl
- variants (json)
- stock
- productCost
- shippingCost
- totalCost
- salePrice
- margin
- weight
- dimensions (json)
- status (enum: DRAFT, PUBLISHED, PAUSED, OUT_OF_STOCK, NOT_PROFITABLE, ARCHIVED)
- seoTitle
- seoDescription
- createdAt
- updatedAt

### Category
- id (UUID)
- name
- slug (único)
- description
- image
- parentId (nullable)
- order
- active
- createdAt
- updatedAt

### Cart
- id (UUID)
- userId (UUID)
- items (json o relación con CartItem)
- couponId (nullable)
- subtotal
- shipping
- discount
- total
- createdAt
- updatedAt

### Order
- id (UUID)
- orderNumber (único)
- userId (UUID)
- status (enum: PENDING_PAYMENT, PAID, PROCESSING, SUPPLIER_ORDERED, SUPPLIER_PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, CANCELLED, REFUND_REQUESTED, REFUND_PROCESSING, REFUNDED, DISPUTED)
- items (json o relación OrderItem)
- subtotal
- shipping
- discount
- total
- paymentId (nullable)
- paymentStatus
- shippingAddress (json)
- tracking (json)
- notes
- createdAt
- updatedAt

### OrderItem
- id (UUID)
- orderId (UUID)
- productId (UUID)
- productName
- productImage
- variant (json)
- quantity
- unitPrice
- totalPrice
- createdAt

### Payment
- id (UUID)
- orderId (UUID)
- amount
- status (enum: PENDING, APPROVED, REJECTED, CANCELLED, REFUNDED, PARTIALLY_REFUNDED)
- paymentMethod
- mercadoPagoId
- mercadoPagoStatus
- mercadoPagoDetail (json)
- paidAt (nullable)
- createdAt
- updatedAt

### Review
- id (UUID)
- productId (UUID)
- userId (UUID)
- orderId (UUID)
- rating (1-5)
- comment
- images (json)
- status (enum: PENDING, APPROVED, REJECTED, HIDDEN, REPORTED)
- verifiedPurchase
- createdAt
- updatedAt

### Return
- id (UUID)
- orderId (UUID)
- userId (UUID)
- reason
- description
- evidence (json)
- status (enum: REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, PROCESSING, REFUNDED, CLOSED)
- refundAmount (nullable)
- createdAt
- updatedAt

### Appeal
- id (UUID)
- returnId (UUID)
- userId (UUID)
- reason
- evidence (json)
- status (enum: APPEAL_REQUESTED, APPEAL_REVIEW, APPEAL_APPROVED, APPEAL_REJECTED)
- resolution (nullable)
- reviewedBy (nullable)
- createdAt
- updatedAt

### Coupon
- id (UUID)
- code (único, uppercase)
- type (enum: PERCENTAGE, FIXED, FREE_SHIPPING)
- value
- minAmount
- maxAmount
- startsAt
- expiresAt
- maxUses
- maxUsesPerUser
- usedCount
- applicableProducts (json, nullable)
- applicableCategories (json, nullable)
- active
- createdAt
- updatedAt

### Wishlist
- id (UUID)
- userId (UUID)
- productId (UUID)
- createdAt

### Address
- id (UUID)
- userId (UUID)
- firstName
- lastName
- phone
- street
- number
- department (nullable)
- comuna
- region
- postalCode (nullable)
- isDefault
- createdAt
- updatedAt

### SupportTicket
- id (UUID)
- userId (UUID)
- subject
- category (enum: ORDER, PAYMENT, SHIPPING, PRODUCT, RETURN, ACCOUNT)
- status (enum: OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED)
- priority (enum: LOW, MEDIUM, HIGH, URGENT)
- messages (json)
- assignedTo (nullable)
- createdAt
- updatedAt

### AuditLog
- id (UUID)
- userId (nullable)
- action
- resource
- resourceId (nullable)
- ip
- userAgent
- metadata (json)
- result
- createdAt

### SupplierProduct
- id (UUID)
- supplier (enum: ALIEXPRESS, TEMU, AMAZON)
- supplierProductId
- productId (UUID, nullable)
- data (json)
- lastSync
- createdAt
- updatedAt

### PriceHistory
- id (UUID)
- productId (UUID)
- oldPrice
- newPrice
- reason
- changedBy (nullable)
- createdAt

## Migraciones

```bash
npm run db:migrate
```

## Seed

```bash
npm run db:seed
```

## Studio

```bash
npm run db:studio
```
