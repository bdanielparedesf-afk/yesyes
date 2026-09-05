# API - YESYES

## Base URL

Desarrollo: `http://localhost:3001/api`
Producción: `https://api.yesyes.cl/api`

## Autenticación

La API utiliza Firebase Authentication. El cliente envía el token ID en el header:

```
Authorization: Bearer <firebase_id_token>
```

## Endpoints públicos

### Autenticación
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Recuperar contraseña
- `POST /api/auth/reset-password` - Restablecer contraseña

### Catálogo
- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Obtener producto
- `GET /api/categories` - Listar categorías
- `GET /api/search` - Buscar productos

### Soporte
- `POST /api/support/tickets` - Crear ticket
- `GET /api/support/tickets` - Listar tickets del usuario

## Endpoints autenticados

### Carrito
- `GET /api/cart` - Obtener carrito
- `POST /api/cart/items` - Agregar item
- `PUT /api/cart/items/:id` - Actualizar cantidad
- `DELETE /api/cart/items/:id` - Eliminar item

### Pedidos
- `POST /api/orders` - Crear pedido
- `GET /api/orders` - Listar pedidos
- `GET /api/orders/:id` - Obtener pedido
- `POST /api/orders/:id/pay` - Iniciar pago

### Favoritos
- `GET /api/wishlist` - Listar favoritos
- `POST /api/wishlist/:productId` - Agregar favorito
- `DELETE /api/wishlist/:productId` - Eliminar favorito

### Reseñas
- `POST /api/reviews` - Crear reseña
- `GET /api/reviews/:productId` - Reseñas de producto

### Devoluciones
- `POST /api/returns` - Solicitar devolución
- `GET /api/returns` - Listar devoluciones

### Apelaciones
- `POST /api/appeals` - Apelar decisión
- `GET /api/appeals` - Listar apelaciones

## Webhooks

- `POST /api/webhooks/mercadopago` - Webhook Mercado Pago

## Admin

Todos los endpoints admin requieren rol y permisos específicos:

- `GET /api/admin/dashboard` - Dashboard
- `GET /api/admin/products` - Listar productos
- `POST /api/admin/products` - Crear producto
- `PUT /api/admin/products/:id` - Actualizar producto
- `GET /api/admin/orders` - Listar pedidos
- `PUT /api/admin/orders/:id` - Actualizar pedido
- `GET /api/admin/refunds` - Listar reembolsos
- `POST /api/admin/refunds/:id/review` - Revisar reembolso
- `GET /api/admin/appeals` - Listar apelaciones
- `POST /api/admin/appeals/:id/resolve` - Resolver apelación
- `GET /api/admin/reviews` - Listar reseñas
- `POST /api/admin/reviews/:id/moderate` - Moderar reseña
- `GET /api/admin/users` - Listar usuarios
- `GET /api/admin/audit` - Logs de auditoría

## Códigos de estado

- `200 OK` - Éxito
- `201 Created` - Recurso creado
- `400 Bad Request` - Error de validación
- `401 Unauthorized` - No autenticado
- `403 Forbidden` - Sin permisos
- `404 Not Found` - Recurso no encontrado
- `409 Conflict` - Conflicto (ej: cupón ya usado)
- `422 Unprocessable Entity` - Error de negocio
- `429 Too Many Requests` - Rate limit
- `500 Internal Server Error` - Error del servidor

## Formato de respuesta

```json
{
  "status": "success",
  "data": { ... }
}
```

Errores:
```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Descripción del error"
}
```

## Notas

- Todos los montos en CLP.
- Las fechas en formato ISO 8601.
- Los IDs son UUIDs.
- La paginación usa `page` y `limit` por defecto.
