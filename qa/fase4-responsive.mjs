/**
 * FASE 4 · RESPONSIVE REAL — auditoría con navegador real (CDP).
 *
 * No simula nada: abre la app real de Vite (http://127.0.0.1:5173), la página
 * real del negocio y mide el DOM real en los 7 anchos obligatorios
 * (375/390/430/768/1024/1280/1440) para EDITOR, PREVIEW y PÚBLICA.
 *
 * Para cada viewport registra: scrollWidth, overflow horizontal, elementos que
 * se salen, overflow oculto artificialmente, texto cortado, imágenes rotas,
 * botones fuera de pantalla y elementos fixed/sticky. Guarda capturas PNG.
 *
 * Uso:  node qa/fase4-responsive.mjs
 * Env:  F4_TOKEN, F4_CDP_PORT, RUN_ID
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CDP } from './business-qa-client.mjs';

const WIDTHS = [375, 390, 430, 768, 1024, 1280, 1440];
const HEIGHT = 900;
const port = Number(process.env.F4_CDP_PORT || 9944);
const base = 'http://127.0.0.1:5173';
const token = process.env.F4_TOKEN || '';
const SLUG = 'clinica-veterinaria-los-robles-14';
const BUSINESS_ID = 'bdaf96cb-a219-4fab-939a-4f0c20d7cf25';
const runId = process.env.RUN_ID || `fase4-responsive-${Date.now()}`;
const outDir = path.resolve('qa/business-captures', runId);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Medición en vivo del documento. Corre dentro de la página real. */
const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const de = document.documentElement;
  const sel = (el) => {
    const id = el.id ? '#' + el.id : '';
    const testid = el.getAttribute('data-testid') ? '[data-testid="' + el.getAttribute('data-testid') + '"]' : '';
    const block = el.getAttribute('data-block-id') ? '[data-block-id="' + el.getAttribute('data-block-id') + '"]' : '';
    const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).slice(0, 4).join('.');
    return el.tagName.toLowerCase() + id + (testid || block) + (cls ? '.' + cls : '');
  };
  const desc = (el) => (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
  const out = {
    vw,
    scrollWidth: Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0),
    scrollHeight: Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0),
    outOfViewport: [], hiddenOverflow: [], cutText: [], brokenImages: [], controlsOut: [],
    fixedSticky: [], gridColumns: {}, images: { total: 0, broken: 0, noObjectFit: 0 },
    nodes: document.querySelectorAll('body *').length,
  };
  const insideScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') && p.scrollWidth > p.clientWidth + 1) return true;
      p = p.parentElement;
    }
    return false;
  };
  const all = Array.from(document.querySelectorAll('body *'));
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') {
      out.images.total++;
      if (el.complete && el.naturalWidth === 0) { out.images.broken++; out.brokenImages.push({ el: sel(el), src: (el.getAttribute('src') || '').slice(0, 90) }); }
      if (s.objectFit === 'fill' || s.objectFit === 'none') out.images.noObjectFit++;
    }
    if ((r.right > vw + 1 || r.left < -1) && out.outOfViewport.length < 25 && !insideScroller(el)) {
      out.outOfViewport.push({ el: sel(el), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
    }
    const clips = (s.overflowX === 'hidden' || s.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0;
    if (clips && out.hiddenOverflow.length < 20) out.hiddenOverflow.push({ el: sel(el), scrollW: el.scrollWidth, clientW: el.clientWidth, overflowX: s.overflowX });
    const hasText = (el.textContent || '').trim().length > 0 && el.children.length === 0;
    if (hasText && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && ['hidden', 'clip'].includes(s.overflowX) && out.cutText.length < 20) {
      out.cutText.push({ el: sel(el), text: desc(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
    }
    if ((tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'summary') && (r.right > vw + 1 || r.left < -1) && out.controlsOut.length < 20) {
      out.controlsOut.push({ el: sel(el), text: desc(el), right: Math.round(r.right) });
    }
    if ((s.position === 'fixed' || s.position === 'sticky') && out.fixedSticky.length < 15) {
      out.fixedSticky.push({ el: sel(el), position: s.position, bottom: s.bottom, right: s.right, z: s.zIndex });
    }
  }
  document.querySelectorAll('[data-block-id] section > div, [data-block-id] > div').forEach((g) => {
    const s = getComputedStyle(g);
    if (s.display !== 'grid') return;
    const key = g.getAttribute('data-block-id') || 'bloque';
    out.gridColumns[key] = (s.gridTemplateColumns || '').split(' ').filter(Boolean).length;
  });
  out.blocks = Array.from(document.querySelectorAll('[data-block-id]')).map((b) => b.getAttribute('data-block-id'));
  out.renderer = document.querySelector('[data-business-renderer]')?.getAttribute('data-business-renderer') || null;
  out.engine = document.querySelector('[data-template-engine]') ? 'v2' : null;
  return out;
})()`;


const report = { runId, startedAt: new Date().toISOString(), widths: WIDTHS, targets: {}, findings: [] };

/** Espera a que el DOM real esté listo (no un sleep fijo). */
async function waitFor(evaluate, expression, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression).catch(() => false)) return true;
    await sleep(700);
  }
  console.log(`  (timeout esperando ${label})`);
  return false;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
    if (res) { const targets = await res.json(); page = targets.find((t) => t.type === 'page'); }
    if (!page) await sleep(500);
  }
  if (!page) throw new Error('Chrome no entrego target CDP');
  const client = new CDP(page.webSocketDebuggerUrl, { defaultTimeoutMs: 30000 });
  await client.open();
  const send = (method, params = {}) => client.send(method, params);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 400));
    return r.result?.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');

  // Sesión QA en localStorage (mismo formato que el persist de zustand).
  await send('Page.navigate', { url: `${base}/` });
  await sleep(3000);
  const session = JSON.stringify({
    state: { user: { id: 'qa', email: 'qa@example.com', name: 'QA', role: 'BUSINESS' }, token, status: 'authenticated' },
    version: 0,
  });
  await evaluate('(() => { localStorage.setItem("yesyes-auth", ' + JSON.stringify(session) + '); return true; })()');

  const targets = [
    { id: 'editor', url: `${base}/negocio/editor?id=${BUSINESS_ID}`, ready: '!!document.querySelector(\'[data-testid="builder-preview"] [data-business-renderer]\')', full: false },
    { id: 'preview', url: `${base}/mi-negocio/${SLUG}?preview=true`, ready: '!!document.querySelector(\'[data-template-engine]\')', full: true },
    { id: 'public', url: `${base}/mi-negocio/${SLUG}`, ready: '!document.body.innerText.includes("Cargando")', full: true },
  ];

  for (const target of targets) {
    report.targets[target.id] = { url: target.url, viewports: {} };
    for (const width of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: width < 768 });
      await send('Page.navigate', { url: target.url });
      await waitFor(evaluate, target.ready, `${target.id}@${width}`);
      // Las imágenes lazy necesitan scroll para cargar y ocupar su caja.
      await evaluate('(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 800) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); return true; })()');
      await sleep(1500);
      const data = await evaluate(MEASURE);
      const overflow = data.scrollWidth - data.vw;
      const status = overflow > 1 || data.images.broken > 0 ? 'FAIL' : 'PASS';
      report.targets[target.id].viewports[width] = { status, overflowPx: overflow, ...data };
      if (status === 'FAIL') report.findings.push({ target: target.id, width, overflowPx: overflow, outOfViewport: data.outOfViewport.slice(0, 5), brokenImages: data.brokenImages.slice(0, 5) });
      console.log(`${status} ${target.id} @${width} overflow=${overflow}px imgRotas=${data.images.broken} cortado=${data.cutText.length} renderer=${data.renderer}`);

      const shotParams = { format: 'png' };
      if (target.full) {
        const metrics = await send('Page.getLayoutMetrics');
        const size = metrics.cssContentSize || metrics.contentSize;
        shotParams.captureBeyondViewport = true;
        shotParams.clip = { x: 0, y: 0, width, height: Math.min(size.height, 14000), scale: 1 };
      }
      const shot = await send('Page.captureScreenshot', shotParams);
      await writeFile(path.join(outDir, `${target.id}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  }

  // Publicación: se registra tal cual, sin intentar saltarse el gate.
  const publishUrl = '/api/businesses/' + BUSINESS_ID + '/publish';
  const publicUrl = '/api/public/businesses/' + SLUG + '/page';
  const probe = async (url, method) => evaluate('(async () => { const r = await fetch(' + JSON.stringify(url) + ', { method: ' + JSON.stringify(method) + ', headers: { "Content-Type": "application/json", Authorization: "Bearer ' + token + '" } }); return { status: r.status, body: (await r.text()).slice(0, 300) }; })()');
  report.publishProbe = await probe(publishUrl, 'POST');
  report.publicProbe = await probe(publicUrl, 'GET');
  console.log('publish:', JSON.stringify(report.publishProbe), 'public:', JSON.stringify(report.publicProbe));

  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nREPORTE:', path.join(outDir, 'report.json'));
  client.close();
}

main().catch(async (error) => {
  report.error = String(error?.message || error);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.error('ERROR:', error);
  process.exit(1);
});
