import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { CDP, CDPError, base, launchChrome, sleep, waitForPortFree } from './business-qa-client.mjs';
import { prepareQaUser, attachQaSubscription, cleanupQaData } from './business-e2e-fixture.mjs';
import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';
import { encode } from '../backend/node_modules/@auth/core/jwt.js';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';

dotenv.config({ path: new URL('../backend/.env', import.meta.url) });
const prisma = new PrismaClient();
const runId = process.env.FINAL_RUN_ID || randomUUID();
const marker = `QA-CERT-${runId}`;
const reportPath = path.resolve('qa/business-e2e-report.json');
const captures = path.resolve('qa/business-captures/e2e', runId);
const ORIGINAL = `${marker} ORIGINAL`;
const UPDATED = `${marker} UPDATED`;
const REPUBLISHED = `${marker} REPUBLISHED`;
const results = { Create: 'FAIL', Builder: 'FAIL', Edit: 'FAIL', Autosave: 'FAIL', Persistence: 'FAIL', Preview: 'FAIL', Publish: 'FAIL', Public: 'FAIL', Modify: 'FAIL', Republish: 'FAIL', 'Public update': 'FAIL', Pause: 'FAIL', Cleanup: 'FAIL' };
const phaseTimings = {};
const evidence = { runId, marker, startedAt: new Date().toISOString(), finishedAt: null, status: 'FAIL', environment: 'QA_REAL_DATABASE_BROWSER', publicUrl: null, network: [], runtime: [], screenshots: [], rateLimited: [], errors: [], phases: phaseTimings };
let chrome, client, user, businessId, slug, stage = 'setup', requests = [], sequence = 0, finalHooks = null;
if (process.env.FINAL_CERTIFICATION === '1') finalHooks = await import('./final-certification-hooks.mjs');

const currentPhase = () => stage;
const send = (method, params = {}, options = {}) => client.send(method, params, { phase: currentPhase(), description: options.description || method, ...options });
const evaluate = async (expression) => { const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, { timeoutMs: 15_000, description: 'Runtime.evaluate' }); if (response.exceptionDetails) throw new CDPError('RUNTIME_EVALUATION_ERROR', response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime evaluation failed', { phase: currentPhase(), operation: 'Runtime.evaluate' }); return response.result?.value; };
const wait = async (expression, timeout = 20_000, label = expression) => { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); } throw new CDPError('UI_WAIT_TIMEOUT', `Timeout: ${label}`, { phase: currentPhase(), operation: 'waitForCondition', timeoutMs: timeout }); };
const click = async (selector) => { const clicked = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return false;n.scrollIntoView({block:'center'});n.click();return true})()`); if (!clicked) throw new Error(`Elemento no encontrado: ${selector}`); };
const clickText = async (text, selector = 'button,a,label') => { const clicked = await evaluate(`(()=>{const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>(x.textContent||'').trim().includes(${JSON.stringify(text)}));if(!n)return false;n.scrollIntoView({block:'center'});n.click();return true})()`); if (!clicked) throw new Error(`Control no encontrado: ${text}`); };
const fillLabel = async (labelText, value) => { const filled = await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(n=>(n.innerText||'').trim().startsWith(${JSON.stringify(labelText)}));const n=label?.querySelector('input,textarea');if(!n)return false;const proto=n instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); if (!filled) throw new Error(`Campo no encontrado: ${labelText}`); };
const fillBuilderTitle = async (value) => { const filled = await evaluate(`(()=>{const root=document.querySelector('[data-testid="builder-inspector"]')||document.querySelector('[data-testid="builder-inspector-desktop"]');const n=root?.querySelector('[data-testid="builder-name-input"]')||root?.querySelector('input');if(!n)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); if (!filled) throw new Error('Campo TÃ­tulo del Builder no encontrado'); };
const screenshot = async (name) => { const capture = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, { timeoutMs: 20_000 }); const file = path.join(captures, `${String(evidence.network.length).padStart(2, '0')}-${name}.png`); await writeFile(file, Buffer.from(capture.data, 'base64')); evidence.screenshots.push({ phase: currentPhase(), file: path.relative(process.cwd(), file), capturedAt: new Date().toISOString() }); };
const request = async (method, urlPart, afterSequence = 0) => { const started = Date.now(); while (Date.now() - started < 20_000) { const found = requests.find((item) => item.event === 'response' && item.method === method && item.url.includes(urlPart) && item.sequence > afterSequence); if (found) { if (found.status < 200 || found.status >= 300) { let detail = ''; try { detail = (await send('Network.getResponseBody', { requestId: found.requestId })).body; } catch {} throw new Error(`${method} ${urlPart}: HTTP ${found.status} ${detail}`); } return found; } await sleep(100); } throw new CDPError('NETWORK_WAIT_TIMEOUT', `No response: ${method} ${urlPart}`, { phase: currentPhase(), operation: 'waitForNetworkResponse', timeoutMs: 20_000 }); };
const publicData = () => evaluate(`(async()=>{const r=await fetch('/api/public/businesses/${slug}/page?qaRun='+Date.now());let body=null;try{body=await r.json()}catch{};const business=body?.business||body;return {status:r.status,body:{...body,business:{...(body.business||body),templateCode:business?.template?.code||business?.templateCode||business?.template||null}}}})()`);
const waitBuilder = () => wait(`location.pathname==='/negocio/editor' && new URLSearchParams(location.search).get('id') && document.querySelector('[data-testid="business-builder"]')`, 35_000, 'Builder actual');
const waitSaved = () => wait(`document.querySelector('[role="status"]')?.textContent?.trim()==='Guardado'`, 20_000, 'estado Guardado');

const installNetwork = () => {
  const pending = new Map();
  client.on('Network.requestWillBeSent', ({ requestId, request }) => {
    if (!request.url.includes('/api/')) return;
    const item = { event: 'request', sequence: ++sequence, stage, requestId, method: request.method, url: request.url, postData: request.postData || null };
    requests.push(item); evidence.network.push(item); pending.set(requestId, item);
  });
  client.on('Network.responseReceived', ({ requestId, response }) => {
    const item = pending.get(requestId); if (!item) return;
    Object.assign(item, { event: 'response', status: response.status }); evidence.network.push(item);
    if (response.status === 429) evidence.rateLimited.push({ stage, url: response.url, timestamp: new Date().toISOString() });
  });
};

async function authenticate() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET requerido para QA Browser');
  const token = await encode({ token: { id: user.userId, sub: user.userId, email: user.email, name: 'QA E2E', role: 'CUSTOMER' }, secret, salt: 'authjs.session-token' });
  const cookie = await send('Network.setCookie', { name: 'authjs.session-token', value: token, url: base, path: '/', httpOnly: true, secure: false, sameSite: 'Lax' });
  if (!cookie.success) throw new Error('Chrome rechazÃ³ la cookie QA');
  await send('Page.navigate', { url: `${base}/negocio` });
  await wait(`document.querySelector('h1') && !document.body.innerText.includes('Cargando sesi')`, 30_000, 'QA login/dashboard');
}

async function createThroughWizard() {
  stage = 'create';
  await send('Page.navigate', { url: `${base}/negocio` });
  await wait(`document.querySelector('h1') && [...document.querySelectorAll('button')].some(n=>(n.textContent||'').includes('Crear p\u00e1gina web'))`, 30_000, 'Business dashboard para create');
  const clicked = await evaluate(`(()=>{const n=[...document.querySelectorAll('button,a')].find(x=>(x.textContent||'').includes('Crear p\u00e1gina web'));if(!n)return false;n.click();return true})()`);
  if (!clicked) {
    const view = await evaluate(`({href:location.href,body:document.body.innerText.slice(0,1200),controls:[...document.querySelectorAll('button,a')].map(n=>({text:(n.textContent||'').trim(),href:n.getAttribute('href')})).slice(0,30)})`);
    throw new Error(`Control no encontrado: Crear pÃ¡gina web: ${JSON.stringify(view)}`);
  }
  await wait(`location.pathname==='/negocio/nuevo' && document.body.innerText.includes('Informaci\u00f3n b\u00e1sica')`, 20_000, 'wizard');
  await fillLabel('Nombre del negocio', ORIGINAL);
  await fillLabel('Descripci\u00f3n', 'Descripci\u00f3n real para certificaci\u00f3n E2E de YesYes.');
  await fillLabel('Tel\u00e9fono', '+56912345678');
  await fillLabel('WhatsApp', '+56912345678');
  await clickText('Continuar');
  await clickText('Florister\u00eda', 'button');
  await clickText('Continuar');
  await wait(`!document.body.innerText.includes('Cargando dise\u00f1os') && [...document.querySelectorAll('button')].some(x=>(x.textContent||'').trim().length>20)`, 20_000, 'selecci\u00f3n template');
  const selectedTemplate = await evaluate(`(()=>{const n=[...document.querySelectorAll('button')].find(x=>/FLOWERS|Flowers|Flor/i.test(x.textContent||''));if(!n)return false;n.click();return true})()`);
  if (!selectedTemplate) throw new Error('No se pudo seleccionar template');
  await evaluate(`(()=>{const n=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Continuar');if(!n)throw new Error('No Continuar: '+document.body.innerText.slice(-1200));n.click()})()`);
  await sleep(500);
  const wizardState = await evaluate(`document.body.innerText`);
  if (!wizardState.includes('Paso 4 de 5')) throw new Error(`wizard no avanzÃ³ a contenido: ${wizardState.slice(-1800)}`);
  await evaluate(`(()=>{const n=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Continuar');if(!n)throw new Error('No Continuar final: '+document.body.innerText.slice(-1200));n.click()})()`);
  await wait(`document.body.innerText.includes('Paso 5 de 5')`, 10_000, 'wizard revisiÃ³n');
  const createSequence = sequence;
  await evaluate(`(()=>{const n=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim().startsWith('Crear'));if(!n)throw new Error('No final button: '+document.body.innerText.slice(-1500));n.click()})()`);
  const created = await request('POST', '/api/businesses', createSequence);
  if (created.status !== 201) throw new Error(`POST /businesses: HTTP ${created.status}`);
  await waitBuilder();
  businessId = await evaluate(`new URLSearchParams(location.search).get('id')`);
  if (!businessId) throw new Error('Builder sin business id');
  await attachQaSubscription(businessId);
  const detail = await authorized();
  if (detail.http !== 200 || detail.business.status !== 'DRAFT' || detail.business.category !== 'FLOWERS') throw new Error(`Business creado invÃ¡lido: ${JSON.stringify(detail)}`);
  slug = detail.business.slug; evidence.publicUrl = `${base}/mi-negocio/${slug}`; results.Create = 'PASS';
}

const authorized = () => evaluate(`(async()=>{const r=await fetch('/api/businesses/${businessId}');const j=await r.json();return {http:r.status,business:j.business}})()`);

async function verifyBuilder() {
  stage = 'builder';
  await wait(`document.querySelector('[data-testid="builder-topbar"]') && document.querySelector('[data-testid="builder-sidebar"]') && document.querySelector('[data-testid="builder-preview"]') && document.querySelector('[data-business-renderer]')`, 30_000, 'estructura Builder');
  const value = await evaluate(`(()=>({url:location.href,renderer:document.querySelector('[data-business-renderer]')?.dataset.businessRenderer,previewText:document.querySelector('[data-testid="builder-preview"]')?.innerText}))()`);
  if (!value.url.startsWith(`${base}/negocio/editor?id=${businessId}`) || !value.renderer || !value.previewText?.includes(ORIGINAL)) throw new Error(`Builder inv?lido: ${JSON.stringify(value)}`);
  results.Builder = 'PASS'; await screenshot('builder');
}

async function editAndAutosave(value) {
  stage = `edit-${value}`; await evaluate(`(()=>{const root=document.querySelector('[data-testid="builder-sidebar"]');const n=[...root?.querySelectorAll('button')||[]].find(x=>/hero|portada|inicio/i.test(x.textContent||''));n?.click();return Boolean(n)})()`); await sleep(100); const before = sequence;
  await fillBuilderTitle(value);
  await wait(`document.querySelector('[role="status"]')?.textContent?.includes('sin guardar')`, 3_000, 'DIRTY');
  results.Edit = 'PASS'; await waitSaved();
  const saved = await request('PUT', `/api/businesses/${businessId}`, before);
  const detail = await authorized();
  if (detail.business.name !== value) throw new Error(`Autosave no persisti? ${value}: ${JSON.stringify({saved, detail})}`);
  results.Autosave = 'PASS';
}

async function verifyPersistence(value) {
  stage = 'persistence'; await send('Page.reload', { ignoreCache: true }); await waitBuilder(); await waitSaved();
  const loaded = await evaluate(`(()=>({body:document.body.innerText.includes(${JSON.stringify(value)}),input:document.querySelector('[data-testid="builder-name-input"]')?.value||document.querySelector('[data-testid="builder-inspector"] input')?.value}))()`);
  if (!loaded.body || loaded.input !== value) throw new Error(`Persistencia UI inv?lida: ${JSON.stringify(loaded)}`);
  results.Persistence = 'PASS';
}

async function openPrivatePreview() {
  stage = 'preview';
  const href = await evaluate(`document.querySelector('[data-testid="builder-preview-button"]')?.href`);
  if (!href?.includes(`/mi-negocio/${slug}?preview=true`)) throw new Error(`Preview URL inv?lida: ${href}`);
  await send('Page.navigate', { url: href });
  await wait(`document.body.innerText.includes('Vista previa') && document.querySelector('[data-business-renderer]') && document.body.innerText.includes('${UPDATED}')`, 30_000, 'preview privada');
  const data = await evaluate(`(()=>({url:location.href,renderer:document.querySelector('[data-business-renderer]')?.dataset.businessRenderer,back:document.body.innerText.includes('Volver al Builder')}))()`);
  if (!data.renderer || !data.back) throw new Error(`Preview no usa BusinessPageRenderer: ${JSON.stringify(data)}`);
  results.Preview = 'PASS'; await screenshot('preview-private');
}

async function publishAndOpenPublic() {
  stage = 'publish'; await send('Page.navigate', { url: `${base}/negocio/editor?id=${businessId}` }); await waitBuilder();
  const before = sequence; await click('[data-testid="builder-publish"]');
  await request('POST', `/api/businesses/${businessId}/publish`, before);
  const detail = await authorized(); if (detail.business.status !== 'PUBLISHED') throw new Error(`Estado publish: ${detail.business.status}`);
  results.Publish = 'PASS';
  stage = 'public'; const data = await publicData();
  if (data.status !== 200 || data.body?.business?.name !== UPDATED || data.body?.business?.status !== 'PUBLISHED') throw new Error(`API p?blica inv?lida: ${JSON.stringify(data)}`);
  await send('Page.navigate', { url: `${evidence.publicUrl}?qaRun=${Date.now()}` });
  await wait(`document.querySelector('[data-business-renderer]') && document.body.innerText.includes('${UPDATED}')`, 30_000, 'p?gina p?blica');
  const dom = await evaluate(`(()=>({renderer:document.querySelector('[data-business-renderer]')?.dataset.businessRenderer,name:document.querySelector('h1')?.innerText,preview:document.body.innerText.includes('Vista previa')}))()`);
  if (dom.name !== UPDATED || dom.renderer !== 'dedicated' || dom.preview) throw new Error(`DOM p?blica inv?lido: ${JSON.stringify(dom)}`);
  results.Public = 'PASS'; await screenshot('public-original');
}

async function modifyRepublish() {
  stage = 'modify'; await send('Page.navigate', { url: `${base}/negocio/editor?id=${businessId}` }); await waitBuilder();
  await editAndAutosave(REPUBLISHED); results.Modify = 'PASS'; stage = 'republish';
  await wait(`document.querySelector('[data-testid="builder-republish"]')`, 10_000, 'bot?n Republicar');
  const before = sequence; await click('[data-testid="builder-republish"]');
  await request('POST', `/api/businesses/${businessId}/publish`, before);
  const detail = await authorized(); if (detail.business.status !== 'PUBLISHED' || detail.business.name !== REPUBLISHED) throw new Error(`Estado republish inv?lido: ${JSON.stringify(detail)}`);
  results.Republish = 'PASS';
  const data = await publicData();
  if (data.status !== 200 || data.body?.business?.name !== REPUBLISHED) throw new Error(`API pÃºblica no actualizada: ${JSON.stringify(data)}`);
  evidence.updatedPublicApi = data;
  await send('Page.navigate', { url: `${evidence.publicUrl}?qaRun=${Date.now()}` });
  const updatedDeadline = Date.now() + 30_000; let updatedDom = null;
  while (Date.now() < updatedDeadline) { updatedDom = await evaluate(`(()=>({body:document.body.innerText,href:location.href}))()`); if (updatedDom.body.includes(REPUBLISHED)) break; await sleep(250); }
  if (!updatedDom?.body.includes(REPUBLISHED)) throw new Error(`p?gina p?blica actualizada no contiene REPUBLISHED: ${JSON.stringify(updatedDom).slice(-1800)}`);
  results['Public update'] = 'PASS'; await screenshot('public-republished');
}

async function pauseAndVerify() {
  stage = 'pause'; await send('Page.navigate', { url: `${base}/negocio/editor?id=${businessId}` }); await waitBuilder();
  await wait(`document.querySelector('[data-testid="builder-pause"]')`, 10_000, 'bot?n Pausar');
  const before = sequence; await click('[data-testid="builder-pause"]');
  await request('POST', `/api/businesses/${businessId}/pause`, before);
  const detail = await authorized(); if (detail.business.status !== 'PAUSED') throw new Error(`Estado pause inv?lido: ${detail.business.status}`);
  const data = await publicData(); if (data.status !== 404) throw new Error(`P?gina pausada a?n p?blica: HTTP ${data.status}`);
  await send('Page.navigate', { url: `${evidence.publicUrl}?qaRun=${Date.now()}` });
  await wait(`document.body.innerText.includes('No pudimos mostrar esta p?gina') || document.body.innerText.includes('No encontramos este negocio') || document.body.innerText.includes('No se pudo cargar')`, 20_000, 'comportamiento p?blico pausado');
  results.Pause = 'PASS'; await screenshot('paused');
}

async function main() {
  await mkdir(captures, { recursive: true }); user = await prepareQaUser(runId);
  const launched = await launchChrome(process.cwd(), { runId }); chrome = launched.chrome; client = new CDP(launched.target.webSocketDebuggerUrl, { runId }); await client.open();
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable'), send('Log.enable')]); installNetwork();
  client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => evidence.runtime.push({ phase: currentPhase(), type: 'exception', text: exceptionDetails.text }));
  client.on('Runtime.consoleAPICalled', ({ type, args }) => { if (type === 'error') evidence.runtime.push({ phase: currentPhase(), type, text: (args || []).map((arg) => arg.value || arg.description || '').join(' ').slice(0,1000) }); });
  client.on('Page.javascriptDialogOpening', () => { void send('Page.handleJavaScriptDialog', { accept: true }); });
  await authenticate();
  if (finalHooks) { stage = 'commerce'; evidence.commerceBrowserE2E = await finalHooks.beforeBusiness({ client, evaluate, wait, clickText }); }
  await createThroughWizard(); await verifyBuilder();
  await editAndAutosave(UPDATED); await verifyPersistence(UPDATED); await openPrivatePreview(); await publishAndOpenPublic(); await modifyRepublish();
  if (finalHooks) { stage = 'responsive'; evidence.responsive = await runIsolated('responsive', () => finalHooks.beforePause({ client, evaluate, wait, businessId, publicUrl: evidence.publicUrl, userId: user.userId, runId })); }
  await runSandbox();
  await pauseAndVerify();
}

/**
 * Fases independientes del recorrido Business (responsive y Mercado Pago
 * Sandbox) fallan sin abortar el resto del recorrido: de lo contrario un
 * FAIL de una de ellas impedia evaluar Pause y se perdia evidencia real de los
 * demas pasos. El fallo queda registrado y la certificacion final lo vuelve a
 * evaluar como criterio propio.
 */
async function runIsolated(name, fn) {
  const previous = stage;
  try { return await fn(); }
  catch (error) {
    const failure = { phase: previous, step: name, errorCode: error?.errorCode || 'ISOLATED_PHASE_ERROR', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() };
    evidence.errors.push(failure);
    console.error(`[BUSINESS_E2E] ${name} FAIL: ${failure.message}`);
    return { status: 'FAIL', error: failure };
  }
}

async function runSandbox() {
  if (!finalHooks || !evidence.commerceBrowserE2E?.productId) throw new Error('Commerce productId required before Mercado Pago Sandbox');
  stage = 'mercado_pago_sandbox';
  evidence.mercadoPagoSandbox = await runIsolated('mercadoPagoSandbox', () => finalHooks.runMercadoPagoSandbox({ runId, productId: evidence.commerceBrowserE2E.productId, variantId: evidence.commerceBrowserE2E.variantId, quantity: 1 }));
}

let cleanup;
try { await main(); }
catch (error) {
  evidence.failure = { phase: currentPhase(), operation: error?.details?.operation || 'business-e2e', errorCode: error?.errorCode || 'BUSINESS_E2E_ERROR', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() };
  evidence.errors.push(evidence.failure); console.error(`[BUSINESS_E2E] FAIL ${currentPhase()}: ${evidence.failure.message}`); process.exitCode = 1;
}
finally {
  const cleanupStarted = Date.now();
  try { if (!user) throw new Error('No se creó usuario QA de esta corrida; cleanup exacto no ejecutado'); cleanup = await cleanupQaData({ userId: user.userId, businessId }); results.Cleanup = cleanup.error || cleanup.residual !== 0 || !cleanup.preexistingPreserved ? 'FAIL' : 'PASS'; }
  catch (error) { cleanup = { error: error instanceof Error ? error.message : String(error) }; results.Cleanup = 'FAIL'; }
  phaseTimings.CLEANUP = { startedAt: new Date(cleanupStarted).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - cleanupStarted, status: results.Cleanup, error: cleanup.error || null };
  client?.close(); chrome?.kill();
  const portFree = await waitForPortFree();
  const pass = Object.values(results).every((value) => value === 'PASS') && !evidence.runtime.some((item) => item.type === 'exception') && portFree;
  evidence.userId = user?.userId || null; evidence.businessId = businessId || null; evidence.slug = slug || null; evidence.chromePortFree = portFree;
  evidence.results = results; evidence.cleanup = cleanup; evidence.finishedAt = new Date().toISOString(); evidence.status = pass ? 'PASS' : 'FAIL';
  await writeFile(reportPath, JSON.stringify(evidence, null, 2)); await prisma.$disconnect();
  if (!pass) process.exitCode = 1;
  console.log(JSON.stringify({ runId, pass, stage, results, cleanup, chromePortFree: portFree }, null, 2));
}

