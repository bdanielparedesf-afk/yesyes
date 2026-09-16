// Disabled: the previous script embedded credentials and probed unverified contracts.
// This is not an OAuth implementation. Rotate the exposed secret in AliExpress.
'use strict';
process.stderr.write('OAuth bloqueado: falta verificar el contrato oficial. Rota el secreto expuesto y configura las credenciales exclusivamente en backend. No se realizo ninguna solicitud.\n');
process.exitCode = 2;
