# Seguridad - YESYES

## Principios

1. Nunca confiar en el frontend para operaciones críticas.
2. Todo cálculo de precio, stock y descuentos se valida en backend.
3. Nunca exponer secretos, API keys o tokens en el frontend.
4. Nunca almacenar números de tarjeta, CVV o datos sensibles de pago.

## Medidas implementadas

- HTTPS obligatorio en producción
- Helmet para cabeceras de seguridad
- CORS configurado restrictivamente
- Rate limiting en endpoints públicos
- Validación y sanitización de todas las entradas (Zod)
- Sesiones seguras
- Cookies seguras (HttpOnly, Secure, SameSite)
- Protección contra XSS
- Protección contra CSRF cuando corresponda
- RBAC en endpoints administrativos
- Logging de seguridad sin datos sensibles

## Autenticación

- Firebase Authentication
- Google OAuth 2.0
- Rate limiting en login
- No revelar si un email existe

## Pagos

- Webhooks verificados con idempotencia
- Validación de pago exclusivamente por backend
- No marcar pedidos como pagados por retorno de navegador

## Datos sensibles

Nunca se registran en logs:
- Contraseñas
- Tokens
- Datos completos de tarjetas
- API keys

## Backups

- Backups automáticos
- Nunca exponer backups públicamente
- Pruebas de restauración periódicas

## Cumplimiento

- Preparado para normativa chilena
- Políticas de privacidad y términos
- Política de cookies y consentimiento
