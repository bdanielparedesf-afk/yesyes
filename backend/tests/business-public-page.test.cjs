const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const route = fs.readFileSync(path.join(__dirname, '../src/routes/public-business.routes.ts'), 'utf8');
const publish = fs.readFileSync(path.join(__dirname, '../src/services/business-publish.service.ts'), 'utf8');

test('payload público agregado usa una consulta relacional de Business', () => {
  assert.ok(route.includes("router.get('/:slug/page'"));
  assert.ok(route.includes('catalogItems:'));
  assert.ok(route.includes("res.json({ ...data, products: catalogItems, team: teamMembers })"));
});

test('contenido público no ejecuta Promise.all sobre un pool limitado', () => {
  const contentRoute = route.slice(route.indexOf("router.get('/:slug/content'"), route.indexOf("router.get('/:slug/services'"));
  assert.doesNotMatch(contentRoute, /Promise\.all/);
});

test('publicación y catálogo Business no dependen de prisma.product', () => {
  assert.doesNotMatch(publish, /prisma\.product/);
  assert.doesNotMatch(route, /prisma\.product/);
});
