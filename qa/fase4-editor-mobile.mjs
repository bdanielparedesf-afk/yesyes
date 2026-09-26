/**
 * FASE 4 · EDITOR V2 en móvil — prueba de INTERACCIÓN real (CDP).
 *
 * Verifica, en el navegador real y con la página real:
 *  1. que la barra de acciones móviles (Secciones / Editar) esté realmente
 *     accesible en el viewport (no fuera de pantalla ni al final del scroll);
 *  2. que el bottom sheet abra, que quepa en el viewport y que sus secciones
 *     sean alcanzables y pulsables;
 *  3. que el canvas conserve el ancho pedido al cambiar de dispositivo;
 *  4. que undo/redo/guardar/publicar sigan siendo pulsables.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CDP } from './business-qa-client.mjs';

const port = Number(process.env.F4_CDP_PORT || 9944);
const base = 'http://127.0.0.1:5173';
const token = process.env.F4_TOKEN || '';
const BUSINESS_ID = 'bdaf96cb-a219-4fab-939a-4f0c20d7cf25';
const runId = process.env.RUN_ID || `fase4-editor-${Date.now()}`;
const outDir = path.resolve('qa/business-captures', runId);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { runId, startedAt: new Date().toISOString(), pasos: [] };
const paso = (name, ok, detalle = '') => { report.pasos.push({ name, ok, detalle }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${detalle}`); return ok; };

async function main() {
  await mkdir(outDir, { recursive: true });
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
    if (res) { const targets = await res.json(); page = targets.find((t) => t.type === 'page'); }
    if (!page) await sleep(500);
  }
  const client = new CDP(page.webSocketDebuggerUrl, { defaultTimeoutMs: 30000 });
  await client.open();
  const send = (m, p = {}) => client.send(m, p);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300));
    return r.result?.value;
  };
  const shot = async (tag) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(outDir, tag + '.png'), Buffer.from(s.data, 'base64'));
  };
  const waitFor = async (expr, label, ms = 90_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await evaluate(expr).catch(() => false)) return true; await sleep(600); }
    console.log('  (timeout ' + label + ')'); return false;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: base + '/' });
  await sleep(3000);
  const session = JSON.stringify({ state: { user: { id: 'qa', email: 'qa@example.com', name: 'QA', role: 'BUSINESS' }, token, status: 'authenticated' }, version: 0 });
  await evaluate('(() => { localStorage.setItem("yesyes-auth", ' + JSON.stringify(session) + '); return true; })()');

  for (const width of [375, 390, 430, 768]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
    await send('Page.navigate', { url: base + '/negocio/editor?id=' + BUSINESS_ID });
    await waitFor('!!document.querySelector(\'[data-testid="builder-preview"] [data-business-renderer]\')', 'editor@' + width);
    await sleep(1200);

    // 1. Barra de acciones móviles dentro del viewport al abrir la página.
    const bar = await evaluate('(() => { const el = document.querySelector(\'[data-testid="builder-mobile-actions"]\'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), vh: window.innerHeight, visible: r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width > 0 }; })()');
    report.pasos.push({ name: 'barra movil @' + width, ok: !!bar && bar.visible, detalle: JSON.stringify(bar) });
    console.log((bar && bar.visible ? 'PASS' : 'FAIL') + ' barra movil visible @' + width + ' :: ' + JSON.stringify(bar));
    await shot('editor-' + width + '-inicio');

    if (bar && bar.visible) {
      // 2. Abrir el bottom sheet de estructura y medirlo.
      await evaluate('(() => { const b = [...document.querySelectorAll(\'[data-testid="builder-mobile-actions"] button\')].find(x => x.textContent.trim() === "Secciones"); b.click(); return true; })()');
      await sleep(900);
      const sheet = await evaluate('(() => { const d = [...document.querySelectorAll(\'[role="dialog"]\')].pop(); if (!d) return null; const r = d.getBoundingClientRect(); const aside = d.querySelector(\'[data-testid="builder-sidebar"]\'); const items = d.querySelectorAll(\'[data-section-type]\').length; return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), vh: window.innerHeight, items, dentro: r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1, asideAncho: aside ? Math.round(aside.getBoundingClientRect().width) : 0 }; })()');
      report.pasos.push({ name: 'bottom sheet @' + width, ok: !!sheet && sheet.dentro && sheet.items > 0, detalle: JSON.stringify(sheet) });
      console.log((sheet && sheet.dentro && sheet.items > 0 ? 'PASS' : 'FAIL') + ' bottom sheet @' + width + ' :: ' + JSON.stringify(sheet));
      await shot('editor-' + width + '-sheet');
      await evaluate('(() => { const d = [...document.querySelectorAll(\'[role="dialog"] button\')].find(b => /Cerrar/.test(b.textContent)); if (d) d.click(); return !!d; })()');
      await sleep(600);
    }

    // 3. Canvas: conserva el ancho pedido y no corta secciones.
    const canvas = await evaluate('(() => { const box = document.querySelector(\'[data-testid="builder-preview"] .overflow-hidden\'); if (!box) return null; const r = box.getBoundingClientRect(); return { w: Math.round(r.width), secciones: document.querySelectorAll(\'[data-testid="builder-preview"] [data-block-section]\').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()');
    report.pasos.push({ name: 'canvas @' + width, ok: !!canvas && canvas.overflow <= 1 && canvas.secciones > 0, detalle: JSON.stringify(canvas) });
    console.log((canvas && canvas.overflow <= 1 && canvas.secciones > 0 ? 'PASS' : 'FAIL') + ' canvas @' + width + ' :: ' + JSON.stringify(canvas));

    // 4. Controles del top bar presentes y pulsables.
    const controls = await evaluate('(() => { const ids = ["builder-undo", "builder-redo", "builder-preview-button", "builder-designs", "builder-save"]; const out = ids.map(id => { const el = document.querySelector(\'[data-testid="\' + id + \'"]\'); if (!el) return id + ":AUSENTE"; const r = el.getBoundingClientRect(); return id + ":" + (r.width > 0 && r.height >= 28 && r.right <= window.innerWidth + 1 ? "ok" : "inaccesible"); }); out.push("builder-publish:" + (document.querySelector(\'[data-testid="builder-publish"]\') ? "ok" : "AUSENTE")); return out; })()');
    const controlsOk = controls.every((c) => c.endsWith(':ok'));
    report.pasos.push({ name: 'top bar @' + width, ok: controlsOk, detalle: controls.join(' ') });
    console.log((controlsOk ? 'PASS' : 'FAIL') + ' top bar @' + width + ' :: ' + controls.join(' '));
  }

  // 5. Dispositivos del canvas en desktop.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base + '/negocio/editor?id=' + BUSINESS_ID });
  await waitFor('!!document.querySelector(\'[data-testid="builder-preview"] [data-business-renderer]\')', 'editor@1440');
  await sleep(1000);
  for (const label of ['Móvil', 'Tableta', 'Escritorio']) {
    await evaluate('(() => { document.querySelector(\'button[aria-label="' + label + '"]\').click(); return true; })()');
    await sleep(800);
    const box = await evaluate('(() => Math.round(document.querySelector(\'[data-testid="builder-preview"] .overflow-hidden\').getBoundingClientRect().width))()');
    const esperado = label === 'Móvil' ? 390 : label === 'Tableta' ? 768 : 0;
    const ok = esperado ? box === esperado : box > 768;
    report.pasos.push({ name: 'canvas ' + label, ok, detalle: 'ancho=' + box });
    console.log((ok ? 'PASS' : 'FAIL') + ' canvas ' + label + ' :: ancho=' + box);
  }
  await shot('editor-1440-dispositivo');

  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nREPORTE:', path.join(outDir, 'report.json'));
  client.close();
}

main().catch(async (e) => { report.error = String(e && e.message || e); await mkdir(outDir, { recursive: true }); await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2)); console.error('ERROR:', e); process.exit(1); });

