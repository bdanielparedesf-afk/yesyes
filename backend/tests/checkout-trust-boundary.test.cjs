const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('el envío se calcula con una política central del backend', () => {
  const source = fs.readFileSync(path.join(root, 'src/services/checkout-pricing.service.ts'), 'utf8');
  assert.match(source, /FREE_SHIPPING_THRESHOLD = 50_000/);
  assert.match(source, /SHIPPING_COST = 4_990/);
  assert.match(source, /subtotal >= FREE_SHIPPING_THRESHOLD \? 0 : SHIPPING_COST/);
});

test('checkout no confia en precio, shipping, total ni crea productos ficticios', () => {
  const source = fs.readFileSync(path.join(root, 'src/controllers/payment.controller.ts'), 'utf8');
  assert.match(source, /resolveTrustedCheckout\(items\)/);
  assert.doesNotMatch(source, /product\.create/);
  assert.doesNotMatch(source, /clientTotal/);
  assert.match(source, /subtotal: checkout\.subtotal/);
  assert.match(source, /shipping: checkout\.shipping/);
  assert.match(source, /total: checkout\.total/);
});

test('los pedidos de cliente requieren autenticación y ownership en la consulta', () => {
  const source = fs.readFileSync(path.join(root, 'src/routes/order.routes.ts'), 'utf8');
  assert.match(source, /router\.use\(authenticate\)/);
  assert.match(source, /where: \{ id: String\(req\.params\.id\), userId: req\.user!\.id \}/);
  assert.doesNotMatch(source, /prisma\.order\.findUnique/);
});

test('las páginas de pedidos no contienen mocks ni imágenes remotas de ejemplo', () => {
  for (const file of ['src/pages/Orders.tsx', 'src/pages/OrderDetail.tsx']) {
    const source = fs.readFileSync(path.join(root, '..', 'frontend', file), 'utf8');
    assert.doesNotMatch(source, /mockOrder|mockOrders|unsplash\.com|yesyes-orders/);
  }
});
