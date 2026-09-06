// Vercel Serverless Function entrypoint (repo root /api).
// Delegates every request to the compiled Express app produced by
// `npm run vercel-build` (backend/dist/index.js).
//
// Nota: el hook de trazado de @auth/core vive dentro del grafo
// (backend/src/lib/auth.ts), no aquí — este archivo está en la raíz del repo,
// donde el paquete no está instalado y el trazo no resolvería nada.
const app = require('../backend/dist/index.js').default;

module.exports = (req, res) => {
  return app(req, res);
};
