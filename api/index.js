// Vercel Serverless Function entrypoint (repo root /api).
// Delegates every request to the compiled Express app produced by
// `npm run vercel-build` (backend/dist/index.js).
const app = require('../backend/dist/index.js').default;

// node-file-trace (el empaquetador de lambdas de Vercel) solo detecta
// require()/import() ESTATICOS. @auth/core es ESM-only y se carga en runtime
// con un import() dinamico real (backend/src/lib/auth.ts), invisible para el
// trazo. Esta rama nunca se ejecuta; su unica funcion es que el trazo incluya
// el paquete (y sus dependencias) dentro de la lambda.
if (process.env.YESYES_TRACE_HOOK === '1') {
  require('@auth/core');
}

module.exports = (req, res) => {
  return app(req, res);
};
