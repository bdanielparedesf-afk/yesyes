// Vercel Serverless Function entrypoint (repo root /api).
// Delegates every request to the compiled Express app produced by
// `npm run vercel-build` (backend/dist/index.js).
const app = require('../backend/dist/index.js').default;

module.exports = (req, res) => {
  return app(req, res);
};
