import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const runId = process.env.FINAL_RUN_ID || 'unassigned';
const widths = [375, 390, 430, 768, 1024, 1280, 1440];
const pages = ['home', 'store', 'product', 'cart', 'checkout', 'business-dashboard', 'business-builder', 'business-public'];
const startedAt = new Date().toISOString();
const outputRoot = path.resolve('qa/final-responsive');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cada pagina tiene una senal de "contenido real listo". Sin esto el harness
 * media el documento nuevo todavia vacio (SPA) y reportaba falsos
 * "contenido vacio" / "loading infinito" que en realidad eran capturas hechas
 * antes de que terminara la carga de datos.
 */
const PAGE_READY = {
  home: `!!document.querySelector('main') && document.body.innerText.length > 800`,
  store: `document.querySelectorAll('a[href*="/productos/"]').length >= 4`,
  product: `!!document.querySelector('main') && document.querySelectorAll('img').length >= 1 && hasAmount(document.body.innerText)`,
  cart: `!!document.querySelector('main') && document.body.innerText.length > 100`,
  checkout: `!!document.querySelector('form')`,
  'business-dashboard': `!!document.querySelector('h1') && !/Cargando/.test(document.body.innerText)`,
  'business-builder': `!!document.querySelector('[data-testid="business-builder"]')`,
  'business-public': `!!document.querySelector('[data-business-renderer]')`,
};

function statusFor(page, metrics, viewport) {
  if (metrics.loading || metrics.brokenImages.length || metrics.overflow || metrics.outside.length || metrics.empty) {
    return { status: 'FAIL', reason: metrics.loading ? 'loading infinito' : metrics.brokenImages.length ? 'imagen rota' : metrics.overflow || metrics.outside.length ? 'elemento fuera del viewport' : 'contenido vacío' };
  }
  const mobile = viewport < 1024;
  const checks = {
    home: { main: metrics.hasMain, header: metrics.hasHeader, footer: metrics.hasFooter, buttons: metrics.buttons >= 3, text: metrics.textLength > 500 },
    store: { header: metrics.hasHeader, footer: metrics.hasFooter, images: metrics.images > 0, buttons: metrics.buttons >= 3, text: metrics.textLength > 300 },
    product: { header: metrics.hasHeader, footer: metrics.hasFooter, images: metrics.images > 0, addToCart: metrics.hasAdd, price: metrics.hasPrice },
    cart: { header: metrics.hasHeader, footer: metrics.hasFooter, items: metrics.hasCartItem, totals: metrics.hasTotals, checkout: metrics.hasCheckout },
    checkout: { header: metrics.hasHeader, footer: metrics.hasFooter, form: metrics.hasForm, totals: metrics.hasTotals, payment: metrics.hasPayment },
    'business-dashboard': { buttons: metrics.buttons > 0, text: metrics.textLength > 150 },
    'business-builder': { builder: metrics.hasBuilder, preview: metrics.hasBuilderTop, actions: metrics.hasBuilderActions },
    'business-public': { renderer: metrics.hasBusinessRenderer, header: metrics.hasHeader, footer: metrics.hasFooter, text: metrics.textLength > 300 },
  };
  if (mobile && page === 'business-builder' && !metrics.hasBuilderActions) return { status: 'FAIL', reason: 'acciones del builder móvil inaccesibles' };
  const failed = Object.entries(checks[page]).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) return { status: 'FAIL', reason: `checks visualessemánticos incompletos (${page}): ${failed.join(', ')}` };
  return { status: 'PASS', evidence: 'captura PNG + DOM visible + imágenes + geometría complementaria' };
}



const metricsExpression = `(()=>{const visible=n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const hasAmount=t=>{const i=t.indexOf('$');return i>=0&&i+1<t.length&&t.charCodeAt(i+1)>=48&&t.charCodeAt(i+1)<=57};const cut=n=>{let p=n.parentElement;while(p){const s=getComputedStyle(p);if(s.overflowX!=='visible'){const r=n.getBoundingClientRect(),pr=p.getBoundingClientRect();if(r.left<pr.left-1||r.right>pr.right+1)return true}p=p.parentElement}return false};const all=[...document.querySelectorAll('body *')].filter(visible);const outside=all.filter(n=>{const r=n.getBoundingClientRect();if(!(r.right>innerWidth+2||r.left<-2))return false;return !cut(n)}).slice(0,15).map(n=>({tag:n.tagName,text:(n.textContent||'').trim().slice(0,80),left:Math.round(n.getBoundingClientRect().left),right:Math.round(n.getBoundingClientRect().right)}));const broken=[...document.images].filter(i=>i.complete&&!i.naturalWidth&&visible(i)).map(i=>i.src);const body=document.body.innerText||'';return {scrollWidth:document.documentElement.scrollWidth,innerWidth,scrollHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+2,outside,brokenImages:broken,images:document.images.length,textLength:body.length,loading:/Cargando…|Cargando producto…|Cargando sesión…/.test(body),empty:body.trim().length<40,hasHeader:!!document.querySelector('header'),hasFooter:!!document.querySelector('footer'),hasMain:!!document.querySelector('main'),hasAdd:[...document.querySelectorAll('button')].some(n=>n.textContent.includes('Agregar al carrito')),hasPrice:hasAmount(body),hasCartItem:!!localStorage.getItem('yesyes-cart')&&JSON.parse(localStorage.getItem('yesyes-cart')).state.items.length>0,hasTotals:body.includes('Subtotal')&&body.includes('Envío')&&body.includes('Total'),hasCheckout:body.includes('Ir a pagar'),hasForm:!!document.querySelector('form')&&body.includes('Datos de envío'),hasPayment:body.includes('Pagar con Mercado Pago'),hasBuilder:!!document.querySelector('[data-testid="business-builder"]'),hasBuilderTop:!!document.querySelector('[data-testid="builder-preview"]'),hasBuilderActions:!!document.querySelector('[data-testid="builder-mobile-actions"]'),hasBusinessRenderer:!!document.querySelector('[data-business-renderer]'),buttons:document.querySelectorAll('button,a').length,flags:{}}})()`;

async function navigate(client, evaluate, page, url) {
  await client.send('Page.navigate', { url }, { phase: 'RESPONSIVE', timeoutMs: 30_000, description: `navigate ${url}` });
  const ready = PAGE_READY[page];
  const probe = `(()=>{const hasAmount=t=>{const i=t.indexOf('$');return i>=0&&i+1<t.length&&t.charCodeAt(i+1)>=48&&t.charCodeAt(i+1)<=57};const b=document.body?document.body.innerText:'';return {len:b.length,ready:Boolean(${ready}),readyState:document.readyState}})()`;
  const deadline = Date.now() + 30_000;
  let lastLength = -1;
  let stable = 0;
  let readySeen = false;
  while (Date.now() < deadline) {
    const state = await evaluate(probe);
    if (state.ready && state.readyState === 'complete') readySeen = true;
    if (readySeen && state.len === lastLength) {
      stable += 1;
      if (stable >= 3) return { settled: true, ready: true };
    } else {
      stable = 0;
    }
    lastLength = state.len;
    await sleep(200);
  }
  return { settled: false, ready: readySeen };
}

async function capture({ client, evaluate, viewport, page, url, folder }) {
  await client.send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, deviceScaleFactor: 1, mobile: viewport < 768 }, { phase: 'RESPONSIVE', description: `viewport ${viewport}` });
  const settled = await navigate(client, evaluate, page, url);
  const metrics = await evaluate(metricsExpression);
  const result = settled.settled ? statusFor(page, metrics, viewport) : { status: 'FAIL', reason: `la página no terminó de cargar en 30s (${page})` };
  const filename = path.join(folder, `${page}.png`);
  const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, { phase: 'RESPONSIVE', timeoutMs: 20_000, description: `screenshot ${viewport}/${page}` });
  await writeFile(filename, Buffer.from(shot.data, 'base64'));
  return { page, viewport, url, status: result.status, reason: result.reason || null, evidence: result.evidence || null, artifact: path.relative(process.cwd(), filename), settled: settled.settled, metrics };
}

export async function runResponsiveCertification({ client, evaluate, businessId, publicUrl, userId }) {
  const productResponse = await fetch('http://127.0.0.1:3001/api/products?limit=100', { signal: AbortSignal.timeout(15_000) });
  if (!productResponse.ok) throw new Error(`GET products responsive: HTTP ${productResponse.status}`);
  const productPayload = await productResponse.json();
  const product = (productPayload.products || []).find((item) => !item.businessId && (!item.status || item.status === 'PUBLISHED') && !item.hidden && (Number(item.stock) >= 1 || (item.productVariants || []).some((variant) => Number(variant.stock) >= 1)));
  if (!product) throw new Error('No existe producto real para responsive');
  const cartItem = await evaluate(`JSON.parse(localStorage.getItem('yesyes-cart')).state.items[0]`);
  if (!cartItem) throw new Error('Cart persistence required before responsive checkout');
  const report = { runId, startedAt, finishedAt: null, status: 'FAIL', userId, businessId, publicUrl, viewports: {}, screenshots: [], errors: [] };
  for (const viewport of widths) {
    const folder = path.join(outputRoot, String(viewport));
    await mkdir(folder, { recursive: true });
    const pageUrls = {
      home: 'http://127.0.0.1:5173/', store: 'http://127.0.0.1:5173/productos', product: `http://127.0.0.1:5173/productos/${encodeURIComponent(product.slug)}`,
      cart: 'http://127.0.0.1:5173/carrito', checkout: 'http://127.0.0.1:5173/checkout', 'business-dashboard': `http://127.0.0.1:5173/negocio?id=${businessId}`,
      'business-builder': `http://127.0.0.1:5173/negocio/editor?id=${businessId}`, 'business-public': publicUrl,
    };
    const records = [];
    for (const page of pages) {
      try { records.push(await capture({ client, evaluate, viewport, page, url: pageUrls[page], folder })); }
      catch (error) { records.push({ page, viewport, url: pageUrls[page], status: 'FAIL', reason: error instanceof Error ? error.message : String(error), errorCode: error?.errorCode || 'RESPONSIVE_PAGE_ERROR', artifact: null }); }
    }
    report.screenshots.push(...records.map((item) => item.artifact).filter(Boolean));
    const viewportPass = records.length === pages.length && records.every((item) => item.status === 'PASS');
    report.viewports[viewport] = { status: viewportPass ? 'PASS' : 'FAIL', pages: Object.fromEntries(records.map((item) => [item.page, item.status === 'PASS' ? { status: 'PASS', evidence: item.artifact } : { status: 'FAIL', reason: item.reason, artifact: item.artifact }])), details: records };
    console.log(`[RESPONSIVE] ${viewport}: ${viewportPass ? 'PASS' : 'FAIL'}`);
  }
  report.status = Object.values(report.viewports).every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
  report.finishedAt = new Date().toISOString();
  await writeFile(path.resolve('qa/final-responsive-report.json'), JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') throw new Error('Responsive certification contiene viewports/páginas FAIL');
  return report;
}
