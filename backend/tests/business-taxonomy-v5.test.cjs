const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
const taxonomy = require('../src/utils/business-taxonomy.ts');
const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
const publicRoutes = fs.readFileSync(path.join(__dirname, '../src/routes/public-business.routes.ts'), 'utf8');
const privateRoutes = fs.readFileSync(path.join(__dirname, '../src/routes/business.routes.ts'), 'utf8');
const frontendTaxonomy = fs.readFileSync(path.join(__dirname, '../../frontend/src/business/taxonomy.ts'), 'utf8');
const upsert = fs.readFileSync(path.join(__dirname, '../src/utils/business.ts'), 'utf8');

const enumBlock = schema.slice(schema.indexOf('enum BusinessCategoryCode'), schema.indexOf('enum PropertyOperation'));
const enumValues = [...enumBlock.matchAll(/^  ([A-Z_]+)$/gm)].map((m) => m[1]);

test('el enum BusinessCategoryCode se conserva completo (no se elimina en la migración)', () => {
  for (const code of ['HAIR', 'BARBER', 'FOOD', 'FLOWERS', 'REAL_ESTATE', 'MECHANIC', 'AUTO', 'DETAILING', 'PRO']) {
    assert.ok(enumValues.includes(code), `el enum debe seguir conteniendo ${code}`);
  }
});

test('el enum sigue siendo la validación de storage y acepta los códigos legacy', () => {
  assert.ok(upsert.includes('ALL_BUSINESS_CATEGORY_CODES'), 'el schema usa la taxonomía, no una lista propia');
  assert.doesNotMatch(upsert, /category: z\.enum\(\[/, 'no hay una segunda lista de categorías en el backend');
  for (const code of enumValues) {
    assert.ok(taxonomy.isKnownCategoryCode(code), `${code} debe seguir siendo un código válido`);
  }
});

test('no hay categorías duplicadas: AUTO y DETAILING colapsan en MECHANIC', () => {
  assert.equal(taxonomy.canonicalCategoryCode('AUTO'), 'MECHANIC');
  assert.equal(taxonomy.canonicalCategoryCode('DETAILING'), 'MECHANIC');
  assert.equal(taxonomy.isLegacyCategoryCode('AUTO'), true);
  assert.equal(taxonomy.isLegacyCategoryCode('DETAILING'), true);
  assert.equal(taxonomy.isLegacyCategoryCode('MECHANIC'), false);
  assert.ok(!taxonomy.BUSINESS_CATEGORY_CODES.includes('AUTO'));
  assert.ok(!taxonomy.BUSINESS_CATEGORY_CODES.includes('DETAILING'));
});

test('cada categoría tiene grupo, label, descripción y CTA en lenguaje humano', () => {
  assert.ok(taxonomy.groupedCategories().length >= 6, 'debe haber varios grupos de rubro');
  for (const { group, categories } of taxonomy.groupedCategories()) {
    assert.ok(categories.length > 0, `${group.label} no puede estar vacío`);
    for (const category of categories) {
      assert.match(category.label, /^[\p{L} ]+$/u, `label humano para ${category.code}`);
      assert.ok(category.description.length > 5, `descripción para ${category.code}`);
      assert.ok(category.cta.length > 3, `cta para ${category.code}`);
      assert.equal(taxonomy.categoryGroupOf(category.code).key, group.key);
    }
  }
});

test('los códigos canónicos son únicos y las plantillas comparten familia', () => {
  const codes = taxonomy.BUSINESS_CATEGORY_CODES;
  assert.equal(new Set(codes).size, codes.length, 'no puede haber códigos repetidos');
  assert.deepEqual(taxonomy.templateFamilyCodes('MECHANIC'), ['MECHANIC', 'AUTO', 'DETAILING']);
  assert.deepEqual(taxonomy.templateFamilyCodes('HAIR'), ['HAIR']);
});

test('los designs exponen nombre y estilo legibles, nunca el código', () => {
  assert.equal(taxonomy.templateDisplayName({ code: 'FLOWERS_SIGNATURE_ATLAS', category: 'FLOWERS' }), 'Floristería · Dirección visual');
  assert.equal(taxonomy.templateDisplayName({ code: 'FLOWERS_02', category: 'FLOWERS' }), 'Floristería · Romántico');
  assert.equal(taxonomy.templateStyleOf('FLOWERS_03'), 'Boutique');
  assert.equal(taxonomy.templateStyleOf('FLOWERS_SIGNATURE_NATIVE'), 'Cercano');
  // Un diseño de industria conserva su nombre propio ("Café Artesanal").
  assert.equal(taxonomy.templateDisplayName({ code: 'CAFE_01', category: 'CAFE', name: 'Café Artesanal' }), 'Café Artesanal');
  for (const template of [{ code: 'FLOWERS_01' }, { code: 'HAIR_SIGNATURE_EDITORIAL' }, { code: 'AUTO_01' }]) {
    assert.equal(taxonomy.isLegacyTemplate(template), true, 'las plantillas V3 se marcan legacy');
  }
  assert.equal(taxonomy.isLegacyTemplate({ code: 'FLOWERS_V5_BENTO', legacy: false }), false);
});

test('dentro de un rubro ningún diseño se muestra con el mismo nombre', () => {
  const codesByCategory = {
    FLOWERS: ['FLOWERS_01', 'FLOWERS_02', 'FLOWERS_03', 'FLOWERS_04', 'FLOWERS_SIGNATURE_EDITORIAL', 'FLOWERS_SIGNATURE_ATLAS', 'FLOWERS_SIGNATURE_NATIVE'],
    HAIR: ['HAIR_01', 'HAIR_02', 'HAIR_03', 'BARBER_01', 'HAIR_SIGNATURE_EDITORIAL', 'HAIR_SIGNATURE_ATLAS', 'HAIR_SIGNATURE_NATIVE'],
    BAKERY: ['BAKERY_01', 'BAKERY_02', 'BAKERY_03', 'BAKERY_04', 'BAKERY_SIGNATURE_EDITORIAL', 'BAKERY_SIGNATURE_ATLAS', 'BAKERY_SIGNATURE_NATIVE'],
    FURNITURE: ['FURNITURE_SIGNATURE_EDITORIAL', 'FURNITURE_SIGNATURE_ATLAS', 'FURNITURE_SIGNATURE_NATIVE'],
  };
  for (const [category, codes] of Object.entries(codesByCategory)) {
    const labels = codes.map((code) => taxonomy.templateDisplayName({ code, category }));
    assert.equal(new Set(labels).size, labels.length, `nombres repetidos en ${category}: ${labels.join(' | ')}`);
    for (const label of labels) assert.doesNotMatch(label, /[A-Z]{3}_/, 'el código no puede aparecer en la galería');
  }
});

test('la galería no ofrece clones: una sola variante por identidad visual', () => {
  assert.equal(taxonomy.designIdentity('MECHANIC_SIGNATURE_ATLAS'), taxonomy.designIdentity('AUTO_SIGNATURE_ATLAS'));
  assert.equal(taxonomy.designIdentity('DETAILING_SIGNATURE_NATIVE'), 'signature:NATIVE');
  // Cada diseño de industria conserva su propia identidad (composición diferente).
  assert.notEqual(taxonomy.designIdentity('MECHANIC_01'), taxonomy.designIdentity('AUTO_01'));
  // El alias legacy FLORES_01 es el mismo layout que FLOWERS_01.
  assert.equal(taxonomy.designIdentity('FLORES_01'), taxonomy.designIdentity('FLOWERS_01'));
  const rows = [
    { code: 'AUTO_SIGNATURE_ATLAS', category: 'AUTO' },
    { code: 'DETAILING_SIGNATURE_ATLAS', category: 'DETAILING' },
    { code: 'MECHANIC_SIGNATURE_ATLAS', category: 'MECHANIC' },
    { code: 'MECHANIC_01', category: 'MECHANIC' },
  ];
  assert.equal(taxonomy.dedupeDesigns(rows).length, 2, 'debe quedar una variante de firma + el diseño de industria');
});

test('la API pública ofrece taxonomía y galería de diseños sin datos sensibles', () => {
  assert.ok(publicRoutes.includes("router.get('/taxonomy'"));
  assert.ok(publicRoutes.includes("router.get('/templates'"));
  assert.ok(publicRoutes.includes('templateDisplayName'), 'la galería usa nombres legibles');
  assert.ok(publicRoutes.includes('functions:'), 'expone funciones en lenguaje humano');
});

test('el listado privado de plantillas mantiene compatibilidad y agrega labels', () => {
  assert.ok(privateRoutes.includes('templateDisplayName'));
  assert.ok(privateRoutes.includes('styleLabel'));
  assert.ok(privateRoutes.includes('templateFamilyCodes(category)'), 'un mecánico ve también los diseños AUTO y DETAILING');
  assert.ok(privateRoutes.includes('code: true, name: true, category: true, capabilities: true'), 'compatibilidad de payload');
});

test('los templates existentes se marcan legacy con campos aditivos', () => {
  assert.match(schema, /style\s+String\?/);
  assert.match(schema, /legacy\s+Boolean\s+@default\(false\)/);
  const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260926090000_business_v5_fase2_ux_foundation/migration.sql'), 'utf8');
  assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS'), 'la migración debe ser aditiva e idempotente');
  assert.ok(migration.includes('SET "legacy" = true'), 'las plantillas V3 se marcan legacy');
  assert.doesNotMatch(migration, /DROP |DELETE |ALTER TYPE/, 'no se destruye nada');
});

test('el frontend y el backend comparten la misma taxonomía', () => {
  for (const code of taxonomy.BUSINESS_CATEGORY_CODES) {
    assert.ok(frontendTaxonomy.includes(`code: '${code}'`), `frontend debe tener ${code}`);
  }
  for (const group of taxonomy.BUSINESS_CATEGORY_GROUPS) {
    assert.ok(frontendTaxonomy.includes(`key: '${group.key}'`), `frontend debe tener el grupo ${group.key}`);
  }
  const frontendAliases = frontendTaxonomy.slice(frontendTaxonomy.indexOf('BUSINESS_CATEGORY_ALIASES'));
  for (const legacy of taxonomy.BUSINESS_CATEGORY_LEGACY_CODES) {
    assert.ok(frontendAliases.includes(`${legacy}:`), `alias legacy compartido: ${legacy}`);
  }
});
