# FASE 3 — E2E Real Mercado Pago (prueba reproducible)

> Estado: **REAL E2E BLOQUEADA POR DEPENDENCIA EXTERNA**.
> Los tests `UNIT / INTEGRATION / MOCKED E2E` pasan. Falta ejecutar este
> procedimiento con credenciales reales. No inventar resultados.

## 1. Requisitos previos (no versionar secretos)

- `MERCADOPAGO_CLIENT_ID` (App MP real).
- `MERCADOPAGO_CLIENT_SECRET` (solo entorno local seguro, nunca repo/logs).
- `MERCADOPAGO_OAUTH_REDIRECT_URI` = URL pública del backend
  `.../api/mercadopago/oauth/callback` registrada en la App MP.
- `MERCADOPAGO_TOKEN_ENCRYPTION_KEY` = 64 hex (32 bytes).
- `MP_E2E_BUSINESS_ID` = Business de prueba cuyo owner es el usuario que autoriza.
- Cuenta de prueba (vendedor) de Mercado Pago para autorizar.

## 2. Flujo esperado

```text
YESYES → Business → Conectar Mercado Pago → Mercado Pago
→ autorizar cuenta de prueba → callback YesYes → authorization_code
→ access_token + refresh_token → BD cifrada
→ live_mode=false → sandbox=true
```

1. `POST /api/businesses/:businessId/mercadopago/connect` autenticado como owner.
   - Respuesta: `{ authorizationUrl, state, businessId }` (sin `codeVerifier`).
2. Abrir `authorizationUrl` en navegador, autorizar con la cuenta de prueba.
3. MP redirige a `.../api/mercadopago/oauth/callback?code=...&state=...`.
4. Verificar redirect final a `/negocio?mp_connected=true`.
5. `GET /api/businesses/:businessId/mercadopago` → `connected=true`, `sandbox=true`.

## 3. Refresh real

```bash
# vía código (no exponer tokens en consola):
# refreshAccessToken(MP_E2E_BUSINESS_ID)
```

Comprobar en BD `business_mercado_pago`:

- `refresh_token_encrypted` cambió (rotado) y descifra al nuevo valor.
- `expiresAt` nuevo (`now + expires_in`).
- `lastVerifiedAt` actualizado.
- `sandbox` coherente con `live_mode`.

## 4. Operación API autenticada (solo lectura, sin cargos)

```bash
# vía código (no exponer tokens en consola):
# verifyAuthenticatedOperation(MP_E2E_BUSINESS_ID)
```

Debe devolver `{ ok: true, mpUserId, sandbox }` usando
`GET https://api.mercadopago.com/users/me` con `Authorization: Bearer <token descifrado>`.

## 5. Producción (opcional, sin operaciones financieras)

Solo con cuenta autorizada para producción: repetir conexión y comprobar
`live_mode=true → sandbox=false`. No realizar compras ni cargos.
