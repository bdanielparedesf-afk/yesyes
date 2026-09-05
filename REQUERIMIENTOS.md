# Requerimientos - YESYES

## Modelo de negocio
- Dropshipping
- Proveedor inicial: AliExpress
- Mercado: Chile
- Moneda: CLP

## Objetivos
- Construir una tienda ecommerce moderna, profesional, segura, rápida, responsive y escalable.

## Características principales
- Tienda pública
- Cuentas de clientes (Email + Google OAuth)
- Carrito de compras
- Checkout
- Mercado Pago
- Pedidos y tracking
- Reseñas (compra verificada)
- Devoluciones y apelaciones
- Cupones
- Favoritos
- Soporte y tickets
- Panel administrativo
- Roles y permisos (RBAC)
- Auditoría
- Analítica
- Seguridad
- Backups

## Regla de rentabilidad
- Margen objetivo: 50%
- Margen mínimo: 40%
- Si un producto no alcanza el margen mínimo, se marca como NOT_PROFITABLE y no se publica.

## Proveedores
- Arquitectura preparada para múltiples proveedores
- Inicial: AliExpress (mock/sandbox hasta credenciales reales)
- Futuro: Temu, Amazon (arquitectura preparada, NO implementada)

## Páginas públicas
/, /productos, /categoria/:slug, /producto/:slug, /buscar, /carrito, /checkout, /login, /registro, /recuperar-password, /perfil, /mis-pedidos, /pedido/:id, /direcciones, /favoritos, /devoluciones, /apelaciones, /contacto, /faq, /terminos, /privacidad, /cookies, /envios, /reembolsos

## Panel administrativo
/admin con dashboard, productos, pedidos, clientes, pagos, reembolsos, apelaciones, reseñas, proveedores, precios, cupones, promociones, tickets, usuarios, auditoría y configuración.

## Fases de desarrollo
Ver documento principal para las 32 fases definidas.
