/**
  paso('S0-carga', inicial.length > 0, 'el editor abrio con ' + inicial.length + ' secciones desde manifest.sections');
  const scenarioMod = './fase5-sections-scenario' + (process.env.F5_SCENARIO === 'b' ? '-b' : '') + '.mjs';
  const scenarioMod = './fase5-sections-scenario' + (process.env.F5_SCENARIO === 'b' ? '-b' : '') + '.mjs';
  const { scenario } = await import(scenarioMod);
/**
 * FASE 5 - QA REAL DE SECCIONES (UI real, sin SQL ni escrituras directas).
 *
 * Conduce el Chrome real contra el editor de la pagina real
 * `clinica-veterinaria-los-robles-14` y certifica, mediante la INTERFAZ:
 *
 *   S3  add section      S4 remove (+ undo/redo)   S5 hide/show
 *   S6  reorder          S7 duplicate               S8 variant change
 *   S9  cambio de diseno (preview NO persiste)     S10 capabilities
 *   S12 autosave + F5    S13 undo/redo combinado
 *
 * El manifest se lee DESPUES por la API (GET), nunca se escribe.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CDP, base, sleep } from './business-qa-client.mjs';
import { encode } from '../backend/node_modules/@auth/core/jwt.js';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';

dotenv.config({ path: new URL('../backend/.env', import.meta.url) });
process.env.BUSINESS_QA_E2E = '1';

const runId = process.env.RUN_ID || `fase5-sections-${Date.now()}`;
const debugPort = 9600 + (process.pid % 300);
const chromePath = 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe';
const captures = path.resolve('qa/business-captures', runId);
const report = { runId, startedAt: new Date().toISOString(), pasos: [], fallos: [], capturas: [] };
const paso = (n, ok, detalle) => { report.pasos.push({ n, ok, detalle }); console.log((ok ? 'PASS ' : 'FAIL ') + n + ' :: ' + detalle); if (!ok) report.fallos.push(n + ' :: ' + detalle); };

async function launchChrome() {
  const { spawn } = await import('node:child_process');
  const profile = path.resolve('logs', 'chrome-f5', runId);
  const child = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1000) });
      const t = (await r.json()).find((i) => i.type === 'page');
      if (t) return { chrome: child, target: t };
    } catch { /* aun no responde */ }
    await sleep(250);
  }
  child.kill();
  throw new Error('Chrome no entrego target CDP');
}

let client, stage = 'init';
const send = (m, p = {}) => client.send(m, p, { phase: stage, description: m });
async function evaluate(expression) {
  // `awaitPromise: false` a proposito: si un clic dispara algo que nunca resuelve
  // (un dialogo nativo, una promesa colgada), esperar el resultado deja el
  // Runtime.evaluate colgado hasta el timeout y se pierde la certificacion entera.
  const r = await send('Runtime.evaluate', { expression, returnByValue: true }, { timeoutMs: 20000 });
  if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}
async function wait(expression, timeout = 30000, label = expression) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await evaluate('Boolean(' + expression + ')')) return; await sleep(200); }
  throw new Error('Timeout esperando: ' + label);
}
async function screenshot(nombre) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(captures, nombre + '.png');
  await writeFile(file, Buffer.from(s.data, 'base64'));
  report.capturas.push(nombre + '.png');
  console.log('   captura: ' + nombre + '.png');
  return file;
}
async function go(url) { await send('Page.navigate', { url }); await sleep(1200); }

/**
 * Clic REAL con el raton sobre un selector.
 *
 * Un `element.click()` desde JS es mas fragil de lo que parece: si el nodo esta
 * `display:none` (la sidebar de escritorio vive tras `hidden lg:block`) el evento
 * no produce el mismo efecto que un clic de usuario. Por eso la fase pide UI real
 * y aqui se despachan los eventos de puntero de verdad.
 */
async function clicReal(selector) {
  const box = await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();if(!r.width)return null;return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  if (!box) throw new Error('Elemento no visible para clic real: ' + selector);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
}

/** Estado de la sidebar tal como la ve el usuario. */
const leerSidebar = () => evaluate(`[...document.querySelectorAll('[data-testid^="builder-section-"]:not([data-testid^="builder-section-select-"])')].map(n=>({id:n.getAttribute('data-testid').replace('builder-section-',''),tipo:n.getAttribute('data-section-type'),habilitada:n.getAttribute('data-section-enabled'),label:(n.querySelector('[data-testid^="builder-section-select-"]')||{}).textContent||''}))`);

/** Orden real en que el RENDERER pinta las secciones dentro del preview. */
const leerRender = () => evaluate(`[...document.querySelectorAll('[data-testid="builder-preview"] [data-block-section]')].map(n=>n.getAttribute('data-block-section'))`);

async function guardar() { await send('Page.reload'); await sleep(2500); }

main().catch((e) => { console.error('ERROR FATAL:', e.message); report.error = e.message; process.exit(1); });

async function main() {
  await mkdir(captures, { recursive: true });
  const { chrome, target } = await launchChrome();
  client = new CDP(target.webSocketDebuggerUrl, { defaultTimeoutMs: 90000 });
  await client.open();
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  // La sidebar de escritorio vive tras hidden lg:block (>=1024px). Con el viewport
  // por debajo, sus botones existen en el DOM pero tienen tamano 0 y ningun clic
  // de usuario los alcanza: la certificacion seria falsa.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  // Un dialogo nativo (confirm/alert) BLOQUEA el hilo del renderer: cualquier
  // Runtime.evaluate posterior se cuelga hasta el timeout. Se cierran solo.
  client.on('Page.javascriptDialogOpening', () => { void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });

  stage = 'login';
  const env = await readFile(new URL('../backend/.env', import.meta.url), 'utf8');
  const secret = (env.match(/^AUTH_SECRET=(.*)$/m) || env.match(/^NEXTAUTH_SECRET=(.*)$/m) || [])[1]?.trim();
  const email = process.env.QA_EMAIL;
  const token = await encode({ token: { id: process.env.QA_USER_ID, sub: process.env.QA_USER_ID, email, name: 'QA Fase5', role: 'BUSINESS' }, secret, salt: 'authjs.session-token' });
  const cookie = await send('Network.setCookie', { name: 'authjs.session-token', value: token, url: base, path: '/', httpOnly: true, secure: false, sameSite: 'Lax' });
  if (!cookie.success) throw new Error('Chrome rechazo la cookie de sesion');

  stage = 'editor';
  await go(base + '/negocio/editor?id=' + process.env.QA_BUSINESS_ID);
  await wait(`document.querySelector('[data-testid="builder-sidebar"]')`, 40000, 'sidebar del editor');
  await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 40000, 'secciones cargadas');
  const inicial = await leerSidebar();
  paso('S0-carga', inicial.length > 0, 'el editor abrio con ' + inicial.length + ' secciones desde manifest.sections');
  globalThis.__ctx = { inicial, leerSidebar, leerRender, guardar, screenshot, wait, evaluate, send, go, clicReal, paso };

  const scenarioMod = './fase5-sections-scenario' + (process.env.F5_SCENARIO === 'b' ? '-b' : '') + '.mjs';
  const { scenario } = await import(scenarioMod);
  await scenario(globalThis.__ctx);

  report.finishedAt = new Date().toISOString();
  report.resumen = { total: report.pasos.length, pass: report.pasos.filter((p) => p.ok).length, fail: report.fallos.length };
  await writeFile(path.join(captures, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== RESUMEN FASE 5 ===');
  console.log('pasos: ' + report.resumen.pass + '/' + report.resumen.total + '  fallos: ' + report.resumen.fail);
  if (report.fallos.length) console.log('FALLOS:\n - ' + report.fallos.join('\n - '));
  console.log('reporte: ' + path.join(captures, 'report.json'));
  client.close();
  chrome.kill();
}

