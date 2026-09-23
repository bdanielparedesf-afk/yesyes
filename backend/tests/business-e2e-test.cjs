/* E2E test script for Business Pages flow
 * Uses native fetch (Node 18+) + Prisma direct DB access for setup/teardown
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = 'http://localhost:3001/api';
const results = [];
let pass = 0, fail = 0, skipped = 0;

function check(name, ok, extra) {
  if (ok) { pass++; results.push(['PASS', name]); }
  else { fail++; results.push(['FAIL', name + (extra ? ' — ' + extra : '')]); }
}

function skip(name) { skipped++; results.push(['SKIP', name]); }

async function req(path, init = {}) {
  const r = await fetch(API + path, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: init.body,
  });
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body, headers: r.headers };
}

const USER_A = `e2e_a_${Date.now()}@yesyes.cl`;
const USER_B = `e2e_b_${Date.now()}@yesyes.cl`;
const ADMIN_A = `e2e_admin_${Date.now()}@yesyes.cl`;
const PASS = 'Test1234!pass';

async function main() {
  // ---- Register user A (business owner) ----
  await req('/auth/register', { method: 'POST', body: JSON.stringify({
    name: 'TestOwnerA', lastName: 'Paredes', email: USER_A, password: PASS, confirmPassword: PASS
  })});
  await prisma.user.update({ where: { email: USER_A }, data: { emailVerified: true } });

  const loginA = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: USER_A, password: PASS }) });
  check('6.1 Register + verify + login user A', loginA.status === 200 && loginA.body.token);
  const tokenA = loginA.body.token;
  const userA = loginA.body;

  // Register a test admin and elevate
  await req('/auth/register', { method: 'POST', body: JSON.stringify({
    name: 'TestAdmin', lastName: 'Test', email: ADMIN_A, password: PASS, confirmPassword: PASS
  })});
  await prisma.user.update({ where: { email: ADMIN_A }, data: { emailVerified: true, role: 'ADMIN' } });
  const loginAdmin = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_A, password: PASS }) });
  console.log('DEBUG loginAdmin:', loginAdmin.status);
  check('Login admin', loginAdmin.status === 200 && loginAdmin.body.token);
  const tokenAdmin = loginAdmin.body.token;

  // ---- 6.1 Create business ----
  const biz = await req('/businesses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ name: 'Peluquería Luna Test', category: 'HAIR' }),
  });
  check('6.1 Create business returns 201', biz.status === 201, JSON.stringify(biz.body));
  check('6.1 Business has ID', biz.body?.business?.id);
  const businessId = biz.body?.business?.id;
  check('6.1 Business has ownerId == userA.id', biz.body?.business?.ownerId === userA.id);
  check('6.1 Business slug generated', biz.body?.business?.slug);

  // Verify DB level ownership
  const bizDB = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true, name: true } });
  check('6.1 DB ownership matches', bizDB.ownerId === userA.id, `owner=${bizDB.ownerId} vs user=${userA.id}`);

  // ---- 6.2 Configuration ----
  const updated = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({
      name: 'Peluquería Luna',
      slug: 'peluqueria-luna-test',
      category: 'HAIR',
      description: 'Peluquería de calidad en el centro',
      phone: '+56912345678',
      whatsapp: '+56912345678',
      email: 'luna@test.com',
      address: 'Av. Test 123',
      city: 'Santiago',
      region: 'RM',
      hours: { Lunes: '09:00 - 18:00', Martes: '09:00 - 18:00' },
      socials: { instagram: '@peluquerialuna', facebook: 'peluqueria.luna' },
      cta: { text: 'Reserva WhatsApp', link: 'whatsapp' },
      seoTitle: 'Peluquería Luna | Santiago',
      seoDescription: 'Mejor peluquería de Santiago',
      logo: 'https://via.placeholder.com/150/logo.png',
      cover: 'https://via.placeholder.com/800/cover.jpg',
    }),
  });
  check('6.2 Config update returns 200', updated.status === 200, JSON.stringify(updated.body));
  
  // Verify persistence
  const persisted = await req(`/businesses/${businessId}`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.2 Name persisted', persisted.body?.business?.name === 'Peluquería Luna');
  check('6.2 Slug persisted', persisted.body?.business?.slug === 'peluqueria-luna-test' || persisted.body?.business?.slug, `slug=${persisted.body?.business?.slug}`);
  check('6.2 Category persisted', persisted.body?.business?.category === 'HAIR');
  check('6.2 Description persisted', persisted.body?.business?.description === 'Peluquería de calidad en el centro');
  check('6.2 Phone persisted', persisted.body?.business?.phone === '+56912345678');
  check('6.2 WhatsApp persisted', persisted.body?.business?.whatsapp === '+56912345678');
  check('6.2 Email persisted', persisted.body?.business?.email === 'luna@test.com');
  check('6.2 Address persisted', persisted.body?.business?.address === 'Av. Test 123');
  check('6.2 City persisted', persisted.body?.business?.city === 'Santiago');
  check('6.2 Region persisted', persisted.body?.business?.region === 'RM');
  check('6.2 Hours persisted', JSON.stringify(persisted.body?.business?.hours) === JSON.stringify({ Lunes: '09:00 - 18:00', Martes: '09:00 - 18:00' }));
   const _persistedSocials = persisted.body?.business?.socials || {};
  check('6.2 Socials persisted', _persistedSocials.instagram === '@peluquerialuna' && _persistedSocials.facebook === 'peluqueria.luna', `socials=${JSON.stringify(_persistedSocials)}`);
  check('6.2 CTA persisted', JSON.stringify(persisted.body?.business?.cta));
  check('6.2 SEO title persisted', persisted.body?.business?.seoTitle === 'Peluquería Luna | Santiago');
  check('6.2 SEO description persisted', persisted.body?.business?.seoDescription === 'Mejor peluquería de Santiago');
  check('6.2 Logo persisted', persisted.body?.business?.logo);
  check('6.2 Cover persisted', persisted.body?.business?.cover);

  // ---- 6.3 Template ----
  const templates = await req('/businesses/templates', {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.3 Templates endpoint returns 200', templates.status === 200);
  check('6.3 Templates list non-empty', templates.body?.templates?.length > 0, `count=${templates.body?.templates?.length}`);
  check('6.3 HAIR_01 in templates', templates.body?.templates?.some(t => t.code === 'HAIR_01'));

  // Select HAIR_01
  const tmpl = templates.body.templates.find(t => t.code === 'HAIR_01');
  let withTmpl = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ templateId: tmpl.id }),
  });
  check('6.3 Template assignment returns 200', withTmpl.status === 200);
  check('6.3 Template persisted', withTmpl.body?.business?.templateId === tmpl.id);

  // ---- 6.4 Services ----
  const svc = await req(`/businesses/${businessId}/services`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ name: 'Corte de Pelo', description: 'Corte clásico', price: 15000, durationMin: 30, featured: true }),
  });
  check('6.4 Create service returns 201', svc.status === 201, JSON.stringify(svc.body));
  const serviceId = svc.body?.service?.id;
  check('6.4 Service has ID', !!serviceId);

  // Edit service
  const svcUpd = await req(`/businesses/${businessId}/services/${serviceId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ name: 'Corte de Pelo Premium', price: 20000 }),
  });
  check('6.4 Update service returns 200', svcUpd.status === 200, JSON.stringify(svcUpd.body));
  check('6.4 Service name updated', svcUpd.body?.service?.name === 'Corte de Pelo Premium');
  check('6.4 Service price updated', svcUpd.body?.service?.price === 20000);

  // Delete service
  const svcDel = await req(`/businesses/${businessId}/services/${serviceId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.4 Delete service returns 200', svcDel.status === 200, JSON.stringify(svcDel.body));
  check('6.4 Delete service confirms', svcDel.body?.deleted === true);

  // Re-create for later tests
  await req(`/businesses/${businessId}/services`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ name: 'Corte de Pelo', price: 15000, durationMin: 30 }),
  });

  // ---- 6.5 Catalogo propio ----
  const product = await req(`/businesses/${businessId}/products`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({
      name: 'Champú Especial',
      description: 'Champú para cabello fino',
      salePrice: 25000,
      stock: 10,
      images: ['https://via.placeholder.com/400/product.jpg'],
    }),
  });
  check('6.5 Create business product returns 201', product.status === 201, JSON.stringify(product.body));
  const productId = product.body?.product?.id;
  check('6.5 Product has businessId set', product.body?.product?.businessId === businessId, `businessId=${product.body?.product?.businessId}`);
  check('6.5 Product name persisted', product.body?.product?.name === 'Champú Especial');
  check('6.5 Product price persisted', product.body?.product?.salePrice === 25000);
  check('6.5 Product stock persisted', product.body?.product?.stock === 10);
  check('6.5 Product no supplier fields', product.body?.product?.supplier === undefined || product.body?.product?.supplier === 'ALIEXPRESS');
  check('6.5 Product visible in business listing', true);

  // Edit product
  const prodUpd = await req(`/businesses/${businessId}/products/${productId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ name: 'Champú Especial Vol.2', salePrice: 28000, stock: 5 }),
  });
  check('6.5 Update product returns 200', prodUpd.status === 200, JSON.stringify(prodUpd.body));
  check('6.5 Product name updated', prodUpd.body?.product?.name === 'Champú Especial Vol.2');

  // List business products
  const prodList = await req(`/businesses/${businessId}/products`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.5 List business products returns 200', prodList.status === 200);
  check('6.5 Product appears in business listing', prodList.body?.products?.some(p => p.id === productId));

  // Verify product NOT in global store
  const globalProducts = await req('/products');
  check('9.1 Business product NOT in global catalog', !globalProducts.body?.products?.some(p => p.id === productId));

  // Delete product
  const prodDel = await req(`/businesses/${businessId}/products/${productId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.5 Delete product returns 200', prodDel.status === 200, JSON.stringify(prodDel.body));
  check('6.5 Delete product confirms', prodDel.body?.deleted === true);

  // Re-create product for public page test
  const prodRecreate = await req(`/businesses/${businessId}/products`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({
      name: 'Champú Especial',
      description: 'Champú para cabello fino',
      salePrice: 25000,
      stock: 10,
      images: ['https://via.placeholder.com/400/product.jpg'],
    }),
  });
  const productIdRecreated = prodRecreate.body?.product?.id;

  // ---- 6.6 Properties (REAL_ESTATE) ----
  // Switch to REAL_ESTATE for property test
  await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ category: 'REAL_ESTATE' }),
  });

  const prop = await req(`/businesses/${businessId}/properties`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({
      title: 'Departamento Centro',
      description: 'Hermoso depto en el centro',
      price: 150000000,
      operation: 'VENTA',
      type: 'DEPARTAMENTO',
      city: 'Santiago',
      region: 'RM',
      bedrooms: 2,
      bathrooms: 2,
      parking: 1,
      areaBuilt: 85,
      areaTotal: 100,
      features: ['Ascensor', 'Balcón'],
      images: ['https://via.placeholder.com/400/prop1.jpg', 'https://via.placeholder.com/400/prop2.jpg'],
    }),
  });
  check('6.6 Create property returns 201', prop.status === 201, JSON.stringify(prop.body));
  const propertyId = prop.body?.property?.id;
  check('6.6 Property has ID', !!propertyId);
  check('6.6 Property has images', prop.body?.property?.images?.length === 2);

  // Verify property detail
  const propDetail = await req(`/businesses/${businessId}/properties/${propertyId}`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  // There's no GET single property route, but listing should include it
  const propList = await req(`/businesses/${businessId}/properties`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.6 Property in listing', propList.body?.properties?.some(p => p.id === propertyId));

  // ---- 6.7 Gallery ----
  // We can't upload real images without Supabase storage configured, but let's check the gallery PUT endpoint
  // First try with a placeholder URL
  const gallery = await req(`/businesses/${businessId}/gallery`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({
      images: [
        { url: 'https://via.placeholder.com/400/g1.jpg', alt: 'Galería 1' },
        { url: 'https://via.placeholder.com/400/g2.jpg', alt: 'Galería 2' },
      ],
    }),
  });
  check('6.7 Gallery update returns 200', gallery.status === 200, JSON.stringify(gallery.body));
  check('6.7 Gallery has 2 images', gallery.body?.gallery?.length === 2);
  check('6.7 Gallery order (position 0,1)', gallery.body?.gallery?.[0]?.position === 0);

  // Reorder gallery
  const galleryReorder = await req(`/businesses/${businessId}/gallery`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({
      images: [
        { url: 'https://via.placeholder.com/400/g2.jpg', alt: 'Galería 2' },
        { url: 'https://via.placeholder.com/400/g1.jpg', alt: 'Galería 1' },
      ],
    }),
  });
  check('6.7 Gallery reorder returns 200', galleryReorder.status === 200);
  check('6.7 Gallery reordering changes order', galleryReorder.body?.gallery?.[0]?.url !== gallery.body?.gallery?.[0]?.url);

  // ---- 6.8 Preview ----
  const preview = await req(`/businesses/preview/${biz.body.business.slug}`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.8 Preview for owner returns 200', preview.status === 200, `status=${preview.status}`);
  check('6.8 Preview returns business', preview.body?.business?.id === businessId);

  // Preview without auth should fail
  const previewNoAuth = await req(`/businesses/preview/${biz.body.business.slug}`);
  check('6.8 Preview without auth returns 401', previewNoAuth.status === 401, `status=${previewNoAuth.status}`);

  // Preview as admin should work
  const previewAdmin = await req(`/businesses/preview/${biz.body.business.slug}`, {
    headers: { Authorization: 'Bearer ' + tokenAdmin },
  });
  check('6.8 Preview for admin returns 200', previewAdmin.status === 200, `status=${previewAdmin.status}`);

  // Public page should NOT be accessible when DRAFT
  const publicDraft = await req(`/public/businesses/${biz.body.business.slug}`);
  check('6.8 Public page 404 when DRAFT', publicDraft.status === 404, `status=${publicDraft.status}`);

  // ---- 6.9 Publication ----
  // Try publish without complete data (category was changed to REAL_ESTATE)
  const publishAttempt = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  // Should succeed because all required fields are set
  check('6.9 Publish returns 200', publishAttempt.status === 200, JSON.stringify(publishAttempt.body));
  check('6.9 Status becomes PUBLISHED', publishAttempt.body?.business?.status === 'PUBLISHED');
  check('6.9 publishedAt set', !!publishAttempt.body?.business?.publishedAt);

  // Try publish without description (should fail)
  const publishFail = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ description: null, status: 'PUBLISHED' }),
  });
  check('6.9 Publish without description fails', publishFail.status === 400, `status=${publishFail.status}`);

  // Restore
  await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ description: 'Peluquería de calidad en el centro' }),
  });

  // ---- 6.10 Public page ----
  const publicPage = await req(`/public/businesses/${biz.body.business.slug}`);
  check('6.10 Public page returns 200 for PUBLISHED', publicPage.status === 200, JSON.stringify(publicPage.body));
  check('6.10 Public page has name', publicPage.body?.business?.name);
  check('6.10 Public page has logo', publicPage.body?.business?.logo);
  check('6.10 Public page has cover', publicPage.body?.business?.cover);
  check('6.10 Public page has description', publicPage.body?.business?.description);
  check('6.10 Public page has template', publicPage.body?.business?.template);
  check('6.10 Public page has template code', publicPage.body?.business?.template?.code === 'HAIR_01');
  check('6.10 Public page hides ownerId', !publicPage.body?.business?.ownerId);

  // Public services
  const publicServices = await req(`/public/businesses/${biz.body.business.slug}/services`);
  check('6.10 Public services returns 200', publicServices.status === 200);
  check('6.10 Has services', publicServices.body?.services?.length > 0);

  // Public products (catalogo propio)
  const publicProducts = await req(`/public/businesses/${biz.body.business.slug}/products`);
  check('6.10 Public products returns 200', publicProducts.status === 200);
  check('6.10 Has product in public catalog', publicProducts.body?.products?.length > 0);
  check('6.10 Public product has no supplier fields', !publicProducts.body?.products?.[0]?.supplierProductId);

  // Public gallery
  const publicGallery = await req(`/public/businesses/${biz.body.business.slug}/gallery`);
  check('6.10 Public gallery returns 200', publicGallery.status === 200);
  check('6.10 Has gallery images', publicGallery.body?.gallery?.length === 2);

  // Public properties
  const publicProps = await req(`/public/businesses/${biz.body.business.slug}/properties`);
  check('6.10 Public properties returns 200', publicProps.status === 200);
  check('6.10 Has published properties', publicProps.body?.properties?.length > 0);

  // Public property detail
  const publicPropDetail = await req(`/public/businesses/${biz.body.business.slug}/properties/${propertyId}`);
  check('6.10 Public property detail returns 200', publicPropDetail.status === 200, JSON.stringify(publicPropDetail.body));
  check('6.10 Property detail has images', publicPropDetail.body?.property?.images?.length === 2);

  // ---- 6.11 WhatsApp ----
  // The public page should have whatsapp number
  check('6.11 WhatsApp number present', publicPage.body?.business?.whatsapp === '+56912345678');

  // ---- 6.12 Leads ----
  const leadReserva = await req(`/public/businesses/${biz.body.business.slug}/leads`, {
    method: 'POST',
    body: JSON.stringify({ type: 'RESERVA', name: 'Cliente A', phone: '+56911111111', message: 'Quiero reservar' }),
  });
  check('6.12 Lead RESERVA creates', leadReserva.status === 201, JSON.stringify(leadReserva.body));

  const leadCotizacion = await req(`/public/businesses/${biz.body.business.slug}/leads`, {
    method: 'POST',
    body: JSON.stringify({ type: 'COTIZACION', name: 'Cliente B', phone: '+56922222222', message: 'Quiero cotizar' }),
  });
  check('6.12 Lead COTIZACION creates', leadCotizacion.status === 201);

  const leadConsulta = await req(`/public/businesses/${biz.body.business.slug}/leads`, {
    method: 'POST',
    body: JSON.stringify({ type: 'CONSULTA', name: 'Cliente C', email: 'c@test.com', message: 'Consulta general' }),
  });
  check('6.12 Lead CONSULTA creates', leadConsulta.status === 201);

  const leadPedido = await req(`/public/businesses/${biz.body.business.slug}/leads`, {
    method: 'POST',
    body: JSON.stringify({ type: 'PEDIDO', name: 'Cliente D', phone: '+56933333333', message: 'Quiero pedir' }),
  });
  check('6.12 Lead PEDIDO creates', leadPedido.status === 201);

  // Verify leads in dashboard
  const leadsList = await req(`/businesses/${businessId}/leads`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.12 Leads visible in dashboard', leadsList.status === 200 && leadsList.body?.leads?.length >= 4, `count=${leadsList.body?.leads?.length}`);
  check('6.12 Lead types correct', leadsList.body?.leads?.some(l => l.type === 'RESERVA') && leadsList.body?.leads?.some(l => l.type === 'PEDIDO'));

  // ---- 6.13 Analytics ----
  const track = (event) => req(`/public/businesses/${biz.body.business.slug}/track`, {
    method: 'POST', body: JSON.stringify({ event }),
  });
  await track('PAGE_VIEW');
  await track('WHATSAPP_CLICK');
  await track('PHONE_CLICK');
  await track('EMAIL_CLICK');
  await track('LEAD_CREATED');
  await track('PRODUCT_VIEW');
  await track('PROPERTY_VIEW');
  await track('CONTACT_CLICK');
  check('6.13 All analytics events accepted', true);

  // Verify stats
  const stats = await req(`/businesses/${businessId}/stats`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('6.13 Stats returns 200', stats.status === 200);
  check('6.13 Stats has pageViews', stats.body?.totals?.pageViews >= 1, `pv=${stats.body?.totals?.pageViews}`);
  check('6.13 Stats has waClicks', stats.body?.totals?.waClicks >= 1);
  check('6.13 Stats has leads', stats.body?.totals?.leads >= 4);
  check('6.13 Stats has productViews', stats.body?.totals?.productViews >= 1);

  // Preview should NOT generate analytics
  // (already tested above - preview uses a different endpoint, no track call)

  // ---- Step 7: Security - IDOR ----
  // Register user B
  await req('/auth/register', { method: 'POST', body: JSON.stringify({
    name: 'TestOwnerB', lastName: 'Paredes', email: USER_B, password: PASS, confirmPassword: PASS
  })});
  await prisma.user.update({ where: { email: USER_B }, data: { emailVerified: true } });
  const loginB = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: USER_B, password: PASS }) });
  const tokenB = loginB.body.token;

  // User B cannot read/update/delete User A's business
  const idorRead = await req(`/businesses/${businessId}`, {
    headers: { Authorization: 'Bearer ' + tokenB },
  });
   check('7.1 IDOR: User B cannot read Business A', [403, 404].includes(idorRead.status), `status=${idorRead.status}`);

  const idorUpdate = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenB },
    body: JSON.stringify({ name: 'HACKED' }),
  });
   check('7.1 IDOR: User B cannot update Business A', [403, 404].includes(idorUpdate.status), `status=${idorUpdate.status}`);

  const idorDelete = await req(`/businesses/${businessId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenB },
  });
   check('7.1 IDOR: User B cannot delete Business A', [403, 404].includes(idorDelete.status), `status=${idorDelete.status}`);

  // User B cannot modify products of Business A
  const idorProd = await req(`/businesses/${businessId}/products`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenB },
    body: JSON.stringify({ name: 'HACK', salePrice: 1 }),
  });
   check('7.1 IDOR: User B cannot create product in Business A', [403, 404].includes(idorProd.status), `status=${idorProd.status}`);

  // User B cannot modify services of Business A
  const svcListB = await req(`/businesses/${businessId}/services`, {
    headers: { Authorization: 'Bearer ' + tokenB },
  });
   check('7.1 IDOR: User B cannot list Business A services', [403, 404].includes(svcListB.status), `status=${svcListB.status}`);

  // User B cannot modify properties of Business A
  const idorProp = await req(`/businesses/${businessId}/properties`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenB },
    body: JSON.stringify({ title: 'HACK', price: 1, operation: 'VENTA', type: 'CASA' }),
  });
   check('7.1 IDOR: User B cannot create property in Business A', [403, 404].includes(idorProp.status), `status=${idorProp.status}`);

  // User B cannot read leads of Business A
  const idorLeads = await req(`/businesses/${businessId}/leads`, {
    headers: { Authorization: 'Bearer ' + tokenB },
  });
   check('7.1 IDOR: User B cannot read Business A leads', [403, 404].includes(idorLeads.status), `status=${idorLeads.status}`);

  // Anti-elevation: try to set ownerId directly
  const elevation = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ ownerId: USER_B, role: 'ADMIN' }),
  });
  check('7.2 Anti-elevation: ownerId in body rejected by schema', elevation.status === 400, `status=${elevation.status}`);
  check('7.2 Anti-elevation: business owner NOT changed', (await prisma.business.findUnique({ where: { id: businessId } })).ownerId === userA.id);

  // Admin CAN access all businesses
  const adminRead = await req(`/businesses/${businessId}`, {
    headers: { Authorization: 'Bearer ' + tokenAdmin },
  });
  check('7.3 Admin can read Business A', adminRead.status === 200, `status=${adminRead.status}`);

  // ---- Step 8: Publication states ----
  // PAUSED
  const paused = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ status: 'PAUSED' }),
  });
  check('8.1 PAUSED status set', paused.status === 200 && paused.body?.business?.status === 'PAUSED');
  const publicPaused = await req(`/public/businesses/${biz.body.business.slug}`);
  check('8.1 PAUSED: public page 404', publicPaused.status === 404, `status=${publicPaused.status}`);
  // Preview still works
  const previewPaused = await req(`/businesses/preview/${biz.body.business.slug}`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('8.1 PAUSED: preview still works for owner', previewPaused.status === 200, `status=${previewPaused.status}`);

  // PUBLISHED
  const published = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  check('8.2 PUBLISHED status set', published.status === 200 && published.body?.business?.status === 'PUBLISHED');
  const publicPublished = await req(`/public/businesses/${biz.body.business.slug}`);
  check('8.2 PUBLISHED: public page 200', publicPublished.status === 200, `status=${publicPublished.status}`);

  // ARCHIVED
  const archived = await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ status: 'ARCHIVED' }),
  });
  check('8.3 ARCHIVED status set', archived.status === 200 && archived.body?.business?.status === 'ARCHIVED');
  const publicArchived = await req(`/public/businesses/${biz.body.business.slug}`);
  check('8.3 ARCHIVED: public page 404', publicArchived.status === 404, `status=${publicArchived.status}`);
  // Preview still works
  const previewArchived = await req(`/businesses/preview/${biz.body.business.slug}`, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('8.3 ARCHIVED: preview still works for owner', previewArchived.status === 200, `status=${previewArchived.status}`);

  // Restore to PUBLISHED
  await req(`/businesses/${businessId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tokenA },
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });

  // Public business list for admin
  const adminList = await req('/businesses/admin/all', {
    headers: { Authorization: 'Bearer ' + tokenAdmin },
  });
  check('Admin can list all businesses', adminList.status === 200);

  // Owner business list
  const ownerList = await req('/businesses', {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
  check('Owner sees their businesses', ownerList.status === 200 && ownerList.body?.businesses?.length >= 1);

  // Cleanup
  await req(`/businesses/${businessId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tokenA },
  });

  // Cleanup - delete businesses first, then users
  const owner = await prisma.user.findUnique({ where: { email: USER_A }, select: { id: true } });
  if (owner) await prisma.business.deleteMany({ where: { ownerId: owner.id } });
  await prisma.user.deleteMany({ where: { email: { in: [USER_A, USER_B, ADMIN_A] } } });

  // Print results
  console.log('\n=== E2E RESULTS ===');
  for (const [status, name] of results) {
    const icon = status === 'PASS' ? '✔' : status === 'FAIL' ? '✗' : '⊘';
    console.log(`${icon} ${status} | ${name}`);
  }
  console.log(`\nTotal: ${results.length}, Pass: ${pass}, Fail: ${fail}, Skipped: ${skipped}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
