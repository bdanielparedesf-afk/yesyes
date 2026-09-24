const fixture = require('./business-v3-http-fixture.cjs');
const { prisma, suffix, emails, request, ok, createUser, login, cleanup } = fixture;

async function main() {
  const userA = await createUser(emails.a);
  const userB = await createUser(emails.b);
  await createUser(emails.admin, 'ADMIN');
  const [tokenA, tokenB, tokenAdmin] = await Promise.all([login(emails.a), login(emails.b), login(emails.admin)]);

  const createA = await request('/businesses', { token: tokenA, method: 'POST', body: { name: `Business A ${suffix}`, category: 'BOUTIQUE' } });
  const createB = await request('/businesses', { token: tokenB, method: 'POST', body: { name: `Business B ${suffix}`, category: 'BAKERY' } });
  ok(createA.status === 201 && createA.body?.business?.ownerId === userA.id, 'OWNER A crea Business A', createA.body);
  ok(createB.status === 201 && createB.body?.business?.ownerId === userB.id, 'OWNER B crea Business B', createB.body);
  const a = createA.body.business;
  const b = createB.body.business;
  fixture.businessIds = [a.id, b.id];

  const productA = await request(`/businesses/${a.id}/products`, { token: tokenA, method: 'POST', body: { name: 'Producto A', price: 19990, active: true } });
  const productB = await request(`/businesses/${b.id}/products`, { token: tokenB, method: 'POST', body: { name: 'Producto B', price: 29990, active: true } });
  const hiddenA = await request(`/businesses/${a.id}/products`, { token: tokenA, method: 'POST', body: { name: 'Oculto A', price: 100, active: false } });
  ok(productA.status === 201 && productB.status === 201 && hiddenA.status === 201, 'ambos owners crean catálogo aislado', { productA: productA.body, productB: productB.body, hiddenA: hiddenA.body });
  const productAId = productA.body.product.id;
  const productBId = productB.body.product.id;

  const listA = await request(`/businesses/${a.id}/products`, { token: tokenA });
  const listB = await request(`/businesses/${b.id}/products`, { token: tokenB });
  ok(listA.body.products.some((item) => item.id === productAId) && !listA.body.products.some((item) => item.id === productBId), 'catálogo A no mezcla B', listA.body);
  ok(listB.body.products.some((item) => item.id === productBId) && !listB.body.products.some((item) => item.id === productAId), 'catálogo B no mezcla A', listB.body);

  const contentA = await request(`/businesses/${a.id}/content/testimonials`, { token: tokenA, method: 'POST', body: { name: 'Cliente A', content: 'Contenido exclusivo de A', rating: 5 } });
  const crossContent = await request(`/businesses/${a.id}/content/testimonials`, { token: tokenB, method: 'POST', body: { name: 'Intruso B', content: 'No debe crear' } });
  const crossProduct = await request(`/businesses/${a.id}/products`, { token: tokenB, method: 'POST', body: { name: 'Intruso', price: 1 } });
  const crossRead = await request(`/businesses/${a.id}`, { token: tokenB });
  ok(contentA.status === 201, 'contenido propio creado', contentA.body);
  ok([403, 404].includes(crossContent.status), 'OWNER B no crea contenido en A', crossContent);
  ok([403, 404].includes(crossProduct.status), 'OWNER B no crea producto en A', crossProduct);
  ok([403, 404].includes(crossRead.status), 'OWNER B no lee detalle de A', crossRead);

  await prisma.business.updateMany({ where: { id: { in: fixture.businessIds } }, data: { status: 'PUBLISHED' } });
  const publicA = await request(`/public/businesses/${a.slug}`);
  const publicContent = await request(`/public/businesses/${a.slug}/content`);
  const publicProducts = await request(`/public/businesses/${a.slug}/products`);
  const global = await request('/products');
  ok(publicA.status === 200, 'página pública A responde 200', publicA.body);
  ok(publicContent.body.testimonials.some((item) => item.id === contentA.body.item.id), 'testimonio A visible públicamente', publicContent.body);
  ok(publicProducts.body.products.some((item) => item.id === productAId) && !publicProducts.body.products.some((item) => item.name === 'Oculto A'), 'público filtra sólo active=true', publicProducts.body);
  ok(!global.body?.products?.some((item) => item.id === productAId || item.id === productBId), 'catálogo Business no aparece en tienda global', global.body);

  const previewA = await request(`/businesses/preview/${a.slug}`, { token: tokenA });
  const previewBCross = await request(`/businesses/preview/${a.slug}`, { token: tokenB });
  ok(previewA.status === 200, 'OWNER A entra a preview de A', previewA.body);
  ok(previewBCross.status === 404, 'OWNER B no entra a preview de A', previewBCross);

  const adminReadA = await request(`/businesses/${a.id}`, { token: tokenAdmin });
  const adminReadB = await request(`/businesses/${b.id}`, { token: tokenAdmin });
  const adminList = await request('/admin/businesses', { token: tokenAdmin });
  ok(adminReadA.status === 200 && adminReadB.status === 200, 'ADMIN lee A y B', { a: adminReadA.status, b: adminReadB.status });
  ok(adminList.status === 200, 'ADMIN lista negocios globales', adminList);
  console.log('E2E_BUSINESS_V3_RESULT PASS');
}

main().catch((error) => { console.error('E2E_BUSINESS_V3_RESULT FAIL'); console.error(error.message || error); process.exitCode = 1; }).finally(cleanup).finally(() => fixture.prisma.$disconnect());

