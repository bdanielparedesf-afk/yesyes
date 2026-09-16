# YesYes + AliExpress: resultado parcial verificado

Fecha: 2026-09-16. NO se alcanzó el criterio de integración completa.

## Implementado

- Firma OAuth HMAC-SHA256 /auth/token/create según contrato aportado, vector local independiente; no confundir con firma DS /sync.
- Transporte de canje server-side con timeout 15s, sin redirects ni reintentos de códigos de un solo uso, mapper de respuesta documentada y errores sin respuestas crudas.
- AES-256-GCM con IV aleatorio y AAD de cuenta/tipo; sin lectura transparente de tokens antiguos en claro.
- Persistencia en aliexpress_tokens mediante Prisma/Supabase. Lectura interna del access token, estado con allowlist y desconexión local.
- CLI npm run aliexpress:exchange: código por stdin; rechaza argumentos y configuración incompleta, nunca imprime tokens. No hay callback OAuth público implementado.
- GET /api/admin/aliexpress/status y POST /api/admin/aliexpress/disconnect: auth/admin existentes, rate limit, no-store y protección de escritura con header personalizado.
- /admin/aliexpress: estado y desconexión, navegación independiente de CJ. Indica integración parcial; no simula importación.
- Helpers de URL normalizada, identidad/duplicados excluyendo CJ, costos con shipping explícito, márgenes 50–400% y personalizado, FX desacoplado de CJ con fuente/fecha.
- npm test corregido para node:test .cjs.

## Migración y Supabase

20260916190000_aliexpress_token_security aplicada con prisma db execute y registrada con prisma migrate resolve --applied después de ejecutar el SQL. Confirmado en _prisma_migrations.

Tabla previamente existente. RLS y FORCE RLS activados; permisos PUBLIC/anon/authenticated revocados. No se modificaron valores anteriores ni se eliminaron datos. Prueba real con OAuth ficticio exclusivamente de test: guardado cifrado, decrypt, upsert sin duplicado y rollback sin residuos.

prisma migrate status: salida 1 por cinco migraciones anteriores no registradas como aplicadas. NO se ejecutaron ni se marcaron falsamente como aplicadas: la inicial no representa el esquema actual. Requiere reconciliación del historial sobre una copia de seguridad/entorno aislado antes de usar migrate deploy.

## Validación

- npm test con ALIEXPRESS_DB_TEST=1: 54 aprobadas, 0 fallos, 0 omitidas.
- Ejecución normal: 53 aprobadas y 1 prueba DB omitida por diseño (opt-in).
- Backend typecheck/build: aprobados.
- Frontend tsc --noEmit/build: aprobados; warning preexistente de bundle >500 kB.
- prisma validate: aprobado.
- Revisión de 10 archivos nuevos de producción: sin patrones de secretos incrustados ni llamadas console. No certifica historial/logs/scripts antiguos.
- CJ: diff vacío en cliente, controller, rutas y job. Regresión funcional remota NO ejecutada.
- FX real mindicador.cl: timeout ECONNABORTED, sin fallback fijo. Fuente manual backend disponible, no configurada automáticamente.
- Pruebas HTTP cubren 401/403, whitelist de respuesta, validación, escritura/CSRF, errores y rate limit. No hubo prueba visual de navegador.

## Estado remoto

No hubo canje con credenciales válidas ni consulta DS autenticada. Las pruebas anteriores InvalidAppKey/IncompleteSignature usaron credenciales ficticias; NO verifican autenticación. Las variables ALIEXPRESS_APP_KEY/APP_SECRET no tenían valor en backend/.env en las comprobaciones realizadas. No se pidieron tokens por chat ni se cambiaron secretos.

Refresh previo desactivado: usaba contrato no verificado, credenciales en URL y no era compatible con cifrado. Cron responde indisponibilidad; no se programó un cron ficticio. /rest/ds/product/list no utilizado porque su contrato no está confirmado.

## Pendiente (no confundir con configuración)

Inicio OAuth y callback con state, contrato/implementación refresh, firma DS y métodos exactos de producto/search/sort/freight/pedidos/tracking. No existe importación individual/masiva, cola, preview de producto, sincronización, historial de producto, acciones masivas, clasificación/traducción integradas, ampliación ProductVariant/OrderItem, snapshot inmutable ni fulfillment. Los helpers no equivalen a esos flujos terminados.

## Configuración backend

ALIEXPRESS_APP_KEY (547536), ALIEXPRESS_APP_SECRET, ALIEXPRESS_TOKEN_ENCRYPTION_KEY (32 bytes aleatorios representados por 64 caracteres hexadecimales). DATABASE_URL/DIRECT_URL con rol privado autorizado. Mantener la clave de cifrado respaldada: cambiarla sin migrar tokens impide descifrarlos.

Plantilla también declara gateway /sync, access/refresh token y seller ID, pero el servicio usa tokens de DB y NO los importa automáticamente del entorno. No hay variables VITE de AliExpress.

FX_SOURCE=manual requiere FX_USD_CLP_RATE y FX_OBSERVED_AT ISO; por defecto usa mindicador.cl. No hay ajuste administrativo de FX implementado.

Para continuar las llamadas reales: configurar credenciales backend y clave, obtener autorización fresca por el flujo oficial y aportar/recuperar contratos DS/refresh exactos. El CLI no reemplaza el flujo OAuth de navegador.
