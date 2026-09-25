const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadBusinessServiceWithApi(api) {
  const sourcePath = path.join(__dirname, '../src/services/business.ts');
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace("import api from '@/lib/axios';", 'const api = globalThis.__businessApi;');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    globalThis: { __businessApi: api },
  });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context);
  return module.exports;
}

test('getPublicPage adapta el payload plano al contrato usado por MiNegocio', async () => {
  const payload = {
    id: 'business-id',
    name: 'QA Flowers',
    slug: 'qa-flowers',
    status: 'PUBLISHED',
    category: 'FLOWERS',
    template: { code: 'FLOWERS_01' },
    services: [],
    products: [],
    properties: [],
    gallery: [],
    testimonials: [],
    faqs: [],
    promotions: [],
    team: [],
    bookingSlots: [],
  };
  const calls = [];
  const { getPublicPage } = loadBusinessServiceWithApi({
    async get(url) {
      calls.push({ method: 'GET', url });
      return { data: payload };
    },
  });

  const result = await getPublicPage('qa-flowers');

  assert.deepEqual(calls, [{ method: 'GET', url: '/public/businesses/qa-flowers/page' }]);
  assert.equal(result.business.id, 'business-id');
  assert.equal(result.business.name, 'QA Flowers');
  assert.equal(result.business.slug, 'qa-flowers');
  assert.equal(result.business.status, 'PUBLISHED');
  assert.equal(result.business.category, 'FLOWERS');
  assert.equal(result.business.template.code, 'FLOWERS_01');
  for (const key of ['services', 'products', 'properties', 'gallery', 'testimonials', 'faqs', 'promotions', 'team', 'bookingSlots']) {
    assert.deepEqual(result[key], [], `${key} debe ser un array`);
  }
});
