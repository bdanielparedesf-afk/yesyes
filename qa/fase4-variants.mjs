/**
 * FASE 4 · AUDITORÍA DE VARIANTES (parte 2: medición real en navegador).
 *
 * Carga el HTML de TODOS los bloques × variantes (generado por
 * `render-variant-cases.cjs`, con el MISMO CSS de la app) y, en los 7 anchos
 * obligatorios, detecta overflow estructural por variante y por escenario
 * (contenido normal, texto extremo, sin imágenes, sin contenido).
 *
 * Un carrusel con `overflow-x:auto` NO es un defecto: sólo se reporta lo que
 * se sale de la caja sin scroller propio.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CDP } from './business-qa-client.mjs';

const WIDTHS = [375, 390, 430, 768, 1024, 1280, 1440];
const ESCENARIOS = ['normal', 'long', 'sinImagen', 'vacio'];
const dir = path.resolve('qa/f4-variants');
const port = Number(process.env.F4_CDP_PORT || 9944);
const runId = process.env.RUN_ID || `fase4-variants-${Date.now()}`;

const MEASURE = `(() => {
  const out = [];
  for (const caso of document.querySelectorAll('[data-caso]')) {
    const box = caso.getBoundingClientRect();
    const limit = caso.clientWidth;
    const offenders = [];
    const inScroller = (el) => {
      let p = el.parentElement;
      while (p && p !== caso) {
        const s = getComputedStyle(p);
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
        p = p.parentElement;
      }
      return false;
    };
    for (const el of caso.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const over = r.right - (box.left + limit);
      if (over > 1 && !inScroller(el)) {
        const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).slice(0, 5).join('.');
        offenders.push({ el: el.tagName.toLowerCase() + (el.getAttribute('data-testid') ? '[data-testid]' : '') + (cls ? '.' + cls : ''), over: Math.round(over), w: Math.round(r.width) });
      }
    }
    out.push({ caso: caso.dataset.caso, escenario: caso.dataset.escenario, clientW: limit, scrollW: caso.scrollWidth, delta: caso.scrollWidth - limit, alto: Math.round(caso.getBoundingClientRect().height), offenders: offenders.slice(0, 4) });
  }
  return out;
})()`;

const outDir = path.resolve('qa/business-captures', runId);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(outDir, { recursive: true });
  const cases = JSON.parse(await readFile(path.join(dir, 'cases.json'), 'utf8'));
  const css = await readFile(path.join(dir, 'app.css'), 'utf8');

  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const res = await fetch('http://127.0.0.1:' + port + '/json', { signal: AbortSignal.timeout(1500) }).catch(() => null);
    if (res) { const targets = await res.json(); page = targets.find((t) => t.type === 'page'); }
    if (!page) await sleep(500);
  }
  const client = new CDP(page.webSocketDebuggerUrl, { defaultTimeoutMs: 40000 });
  await client.open();
  const send = (m, p = {}) => client.send(m, p);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300));
    return r.result?.value;
  };
  await send('Page.enable'); await send('Runtime.enable');

  // Las variables de tema (--biz-*) son las REALES de la página en vivo.
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/mi-negocio/clinica-veterinaria-los-robles-14?preview=true' });
  await sleep(9000);
  const themeVars = await evaluate('(() => { const s = getComputedStyle(document.documentElement); const names = ["--biz-primary", "--biz-primary-contrast", "--biz-radius", "--biz-shadow", "--biz-border", "--biz-bg", "--biz-text"]; const out = {}; for (const n of names) { const v = s.getPropertyValue(n).trim(); if (v) out[n] = v; } const r = document.querySelector("[data-business-renderer]") || document.body; for (const n of names) { const v = getComputedStyle(r).getPropertyValue(n).trim(); if (v) out[n] = v; } return out; })()');

  const html = ['<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<style>' + css + '</style>',
    '<style>:root{' + Object.entries(themeVars).map(([k, v]) => k + ':' + v).join(';') + '}</style>',
    '<style>body{margin:0;font-family:Poppins,sans-serif;background:#fff}.caso{border-bottom:4px solid #e11} h2{font:700 11px monospace;background:#111;color:#fff;padding:2px 4px;margin:0}</style>',
    '</head><body>'];
  for (const c of cases) {
    for (const esc of ESCENARIOS) {
      const body = c[esc] || '';
      html.push('<div data-caso="' + c.key + '" data-escenario="' + esc + '" class="caso"><h2>' + c.key + ' · ' + esc + (body ? '' : ' · (null)') + '</h2>' + body + '</div>');
    }
  }
  html.push('</body></html>');
  const htmlPath = path.join(dir, 'cases.html');
  await writeFile(htmlPath, html.join(''));


  const report = { runId, startedAt: new Date().toISOString(), themeVars, cases: cases.length, viewports: {}, fails: [] };

  // CONTROL NEGATIVO: si el detector no ve un desborde inventado, el PASS es falso.
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'file:///' + htmlPath.replace(/\\/g, '/') });
  await sleep(1500);
  const control = await evaluate('(() => { const d = document.createElement("div"); d.id = "control"; d.style.cssText = "width:900px;height:20px;background:red"; document.body.prepend(d); return true; })()');
  await sleep(500);
  const controlResult = await evaluate('(() => { const d = document.getElementById("control"); const r = d.getBoundingClientRect(); return { w: Math.round(r.width), scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }; })()');
  report.controlNegativo = { insertado: control, ...controlResult, detecta: controlResult.scrollW > controlResult.vw };
  console.log('CONTROL negativo: ' + (report.controlNegativo.detecta ? 'detecta overflow (OK)' : 'NO detecta (harness roto)'));
  await evaluate('(() => { document.getElementById("control")?.remove(); return true; })()');

  for (const width of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await send('Page.navigate', { url: 'file:///' + htmlPath.replace(/\\/g, '/') });
    await sleep(2500);
    const data = await evaluate(MEASURE);
    const fails = data.filter((d) => d.offenders.length > 0);
    report.viewports[width] = { total: data.length, fails: fails.length, deltas: data.filter((d) => d.delta > 1).map((d) => d.caso + '|' + d.escenario + '|' + d.delta) };
    for (const f of fails) report.fails.push({ width, ...f });
    console.log((fails.length ? 'FAIL' : 'PASS') + ' variantes @' + width + ' :: casos=' + data.length + ' conOverflow=' + fails.length);
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'file:///' + htmlPath.replace(/\\/g, '/') });
  await sleep(2000);
  const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 375, height: 4000, scale: 1 } });
  await writeFile(path.join(outDir, 'variants-375.png'), Buffer.from(s.data, 'base64'));

  const resumen = {};
  for (const f of report.fails) {
    const k = f.caso + '|' + f.escenario;
    resumen[k] = resumen[k] || { anchos: [], over: 0, ejemplo: f.offenders[0] };
    if (!resumen[k].anchos.includes(f.width)) resumen[k].anchos.push(f.width);
    resumen[k].over = Math.max(resumen[k].over, f.offenders[0].over);
  }
  report.resumen = resumen;
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nREPORTE:', path.join(outDir, 'report.json'));
  console.log('variantes con overflow:', Object.keys(resumen).length, '/', cases.length * ESCENARIOS.length);
  client.close();
}

main().catch(async (e) => { console.error('ERROR:', e); process.exit(1); });
