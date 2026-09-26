/**
 * FASE 2 â€” CERTIFICACION DEL FLUJO REAL DE CREACION Y EDICION (UI REAL).
 *
 * Reglas de la fase:
 *  - La pagina se crea EXCLUSIVAMENTE desde la UI: registro en /register,
 *    asistente en /negocio/nuevo, editor en /negocio/editor.
 *  - CERO escrituras directas a la base de datos: este script no importa Prisma.
 *    Solo `fetch` de LECTURA dentro del navegador para certificar.
 *  - CERO SQL, CERO seed, CERO creacion manual de Business/SiteInstance.
 *  - La imagen es REAL: binario local subido por el input de archivo de la propia
 *    UI (Supabase Storage por detras) y se comprueba URL publica -> editor ->
 *    recarga (F5).
 *  - La publicacion se intenta y se registra tal cual; si el gate de Mercado Pago
 *    la bloquea se reporta BLOCKED_EXTERNAL_DEPENDENCY (no es un fallo de Fase 2).
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CDP, base, sleep } from './business-qa-client.mjs';

const runId = process.env.RUN_ID || `fase2-${Date.now()}`;
const debugPort = 9700 + (process.pid % 200);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const captures = path.resolve('qa/business-captures', runId);
const report = {
  runId,
  startedAt: new Date().toISOString(),
  objetivo: 'Clinica Veterinaria Los Robles',
  pasos: [],
  problemas: [],
  limites: [],
  evidencia: {},
  responsive: [],
  status: 'EN_CURSO',
};

const CAND = path.resolve('logs/cand');
const REAL_IMAGE = path.join(CAND, '1516734212186-a967f81ad0d7.jpg');
const B = {
  name: 'Clinica Veterinaria Los Robles',
  description:
    'Atencion veterinaria integral en Osorno: consulta, vacunas, cirugias, profilaxis dental, hospedaje y urgencias 24 horas. Medicos veterinarios con licencia regional vigente.',
  phone: '+56 61 234 5678',
  whatsapp: '+56 61 234 5678',
  email: 'contacto@vetlosrobles.cl',
  address: 'Avenida Principal 742',
  city: 'Osorno',
  socials: '@vetlosrobles',
  cta: 'Agendar hora',
};
const SERVICES = [
  { name: 'Consulta y evaluacion clinica', description: 'Revision completa, pesar, examenes y plan de tratamiento escrito.', price: '25000', duration: '30' },
  { name: 'Profilaxis dental', description: 'Limpieza dental con anestesia y radiografia intraoral.', price: '85000', duration: '90' },
  { name: 'Urgencias 24 horas', description: 'Atencion de emergencia todos los dias del ano.', price: '55000', duration: '60' },
];
const PRODUCTS = [
  { name: 'Alimento balanceado adulto 3 kg', short: 'Racion completa de 3 kg.', desc: 'Alimento seco para perros adultos.', price: '8900', category: 'Alimentacion' },
  { name: 'Shampoo sanitizer 500 ml', short: 'Shampoo dermatologico.', desc: 'Shampoo de uso veterinario.', price: '6990', category: 'Higiene' },
];
const TESTIMONIALS = [
  { name: 'Carla Fuentes', role: 'Duena de Nube', content: 'Atendieron a mi perrita un domingo de noche cuando no encontre otra clinica abierta.' },
];
const FAQS = [{ question: 'Aceptan emergencias sin cita?', answer: 'Si. La guardia veterinaria atiende las 24 horas todos los dias del ano.' }];
const TEAM = [{ name: 'Dra. Constanza Alvarez', role: 'Medica veterinaria', bio: 'Lidera el equipo medico y la unidad de cuidados intensivos.' }];

let chrome, client, businessId, slug, stage = 'init', email = '';
const send = (method, params = {}, options = {}) => client.send(method, params, { phase: stage, description: method, ...options });

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, { timeoutMs: 30_000 });
  if (r.exceptionDetails) throw new Error(`JS: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result?.value;
}
async function wait(expression, timeout = 30_000, label = expression) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Timeout esperando: ${label}`);
}
async function go(url) { await send('Page.navigate', { url }); }
async function viewport(width, height = 900) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await sleep(600);
}
async function clickText(text, selector = 'button,a,label,[role="tab"]') {
  const ok = await evaluate(`(()=>{const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>(x.textContent||'').trim().includes(${JSON.stringify(text)}) && x.offsetParent!==null);if(!n)return false;n.scrollIntoView({block:'center'});n.click();return true})()`);
  if (!ok) {
    const view = await evaluate(`({path:location.pathname,controles:[...document.querySelectorAll('button,a,label')].map(n=>(n.textContent||'').trim()).filter(Boolean).slice(0,45)})`);
    throw new Error(`Control no encontrado: "${text}" | ${JSON.stringify(view).slice(0, 900)}`);
  }
}


async function clickExact(text, selector = 'button,a,label,[role="tab"]') {
  const ok = await evaluate(`(()=>{const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>(x.textContent||'').trim()===${JSON.stringify(text)} && x.offsetParent!==null);if(!n)return false;n.scrollIntoView({block:'center'});n.click();return true})()`);
  if (!ok) {
    const debug = await evaluate(`({path:location.pathname,botones:[...document.querySelectorAll('button')].map(b=>({t:(b.textContent||'').trim().slice(0,30),type:b.type||'(none)',vis:b.offsetParent!==null})),formularios:document.querySelectorAll('form').length,labels:[...document.querySelectorAll('label')].map(l=>l.innerText.trim().slice(0,25))})`);
    throw new Error(`Control exacto no encontrado: "${text}" | ${JSON.stringify(debug).slice(0, 1200)}`);
  }
}
async function fillLabel(labelText, value) {
  const ok = await evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(n=>(n.innerText||'').trim().startsWith(${JSON.stringify(labelText)}));const n=l?.querySelector('input,textarea,select');if(!n)return false;const p=n instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:n instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  if (!ok) throw new Error(`Campo no encontrado: "${labelText}"`);
}
async function fillPlaceholder(placeholder, value) {
  const ok = await evaluate(`(()=>{const n=document.querySelector('input[placeholder*=${JSON.stringify(placeholder)}],textarea[placeholder*=${JSON.stringify(placeholder)}]');if(!n)return false;const p=n instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  if (!ok) throw new Error(`Placeholder no encontrado: "${placeholder}"`);
}
async function setFiles(selector, files, index = 0) {
  const doc = await send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector });
  if (!nodeIds?.length) throw new Error(`input file no encontrado: ${selector}`);
  await send('DOM.setFileInputFiles', { files, nodeId: nodeIds[index] });
  return nodeIds.length;
}
async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(captures, `${name}.png`), Buffer.from(data, 'base64'));
  return name;
}
async function step(name, fn) {
  stage = name;
  const t0 = Date.now();
  try {
    const detail = await fn();
    report.pasos.push({ name, status: 'OK', ms: Date.now() - t0, detail: detail ?? null });
    console.log(`OK    ${name} ${JSON.stringify(detail ?? null).slice(0, 500)}`);
    return detail;
  } catch (error) {
    report.pasos.push({ name, status: 'FALLO', ms: Date.now() - t0, error: String(error?.message || error).slice(0, 600) });
    report.problemas.push({ paso: name, error: String(error?.message || error).slice(0, 600) });
    console.log(`FALLO ${name}: ${error?.message || error}`);
    return null;
  }
}
/** Fetch de LECTURA dentro del navegador, con el mismo token que usa la UI. */
const apiGet = (p) => evaluate(`(async()=>{const raw=localStorage.getItem('yesyes-auth');const token=raw?JSON.parse(raw).state?.token:null;const r=await fetch(${JSON.stringify(p)},{headers:token?{Authorization:'Bearer '+token}:{}});const t=await r.text();let j=null;try{j=JSON.parse(t)}catch(e){}return {status:r.status,body:j||t.slice(0,400)}})()`);
const listSections = () => evaluate(`[...document.querySelectorAll('[data-testid="builder-sidebar"] [data-testid^="builder-section-select-"]')].map(n=>n.textContent.trim())`);
const builderState = () => evaluate(`(document.querySelector('[data-testid="builder-topbar"] [role="status"]')||{}).innerText||''`);
const previewText = () => evaluate(`(()=>{const r=document.querySelector('[data-testid="business-builder"] [data-business-renderer]');return r?r.innerText:""})()`);
const previewImages = () => evaluate(`[...document.querySelectorAll('[data-testid="business-builder"] [data-business-renderer] img')].map(n=>n.getAttribute('src'))`);
const selectHeroSection = () => evaluate(`(()=>{const n=[...document.querySelectorAll('[data-testid="builder-sidebar"] [data-testid^="builder-section-select-"]')].find(x=>(x.textContent||'').trim().toLowerCase().includes('portada'));if(n)n.click();return !!n})()`);
async function launchChromeIsolated() {
  const profile = path.resolve('logs', 'chrome-fase2', runId);
  const child = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1_000) });
      const targets = await response.json();
      const target = targets.find((item) => item.type === 'page');
      if (target) return { chrome: child, target };
    } catch { /* Chrome aun no responde */ }
    await sleep(250);
  }
  child.kill();
  throw new Error('Chrome no entrego target CDP');
}

/* 1) REGISTRO DESDE LA UI (sin fixtures, sin escrituras directas) */
async function registerThroughUi() {
  email = `fase2.${Date.now()}@example.com`;
  await go(`${base}/register`);
  await wait(`!!document.querySelector('form input[type="email"]')`, 30_000, 'formulario de registro');
  await fillPlaceholder('Tu nombre', 'Certificacion');
  await fillPlaceholder('Tu apellido', 'Fase Dos');
  await fillPlaceholder('tu@email.com', email);
  const pwdInputs = await evaluate(`document.querySelectorAll('form input[type="password"]').length`);
  if (pwdInputs < 2) throw new Error('El formulario de registro no pide dos contrasenas');
  const pwd = 'Fase2-QA-2026';
  await evaluate(`(()=>{const n=[...document.querySelectorAll('form input[type="password"]')];const p=HTMLInputElement.prototype;for(const el of n){Object.getOwnPropertyDescriptor(p,'value').set.call(el,${JSON.stringify(pwd)});el.dispatchEvent(new Event('input',{bubbles:true}))}return n.length})()`);
  await screenshot('01-registro');
  await clickText('Crear Cuenta', 'button[type="submit"]');
  await wait(`!!JSON.parse(localStorage.getItem('yesyes-auth')||'{}')?.state?.token`, 30_000, 'sesion iniciada tras el registro');
  const who = await evaluate(`JSON.parse(localStorage.getItem('yesyes-auth')).state.user.email`);
  return { email: who, registroPorUI: who === email };
}

/* 2) ASISTENTE: rubro Veterinaria + diseno real + datos basicos */
async function wizard() {
  await go(`${base}/negocio`);
  await wait(`[...document.querySelectorAll('button,a')].some(n=>(n.textContent||'').includes('Crear p\u00e1gina web'))`, 30_000, 'boton Crear pagina web');
  await clickText('Crear p\u00e1gina web');
  await wait(`location.pathname==='/negocio/nuevo' && document.body.innerText.includes('Tipo de negocio')`, 20_000, 'asistente');
  await clickText('Cuidado de mascotas', 'button');
  await clickText('Continuar');
  await wait(`!!document.querySelector('[data-testid="design-gallery"] article')`, 30_000, 'galeria de disenos');
  const designs = await evaluate(`[...document.querySelectorAll('[data-testid="design-gallery"] article h3')].map(n=>n.textContent.trim())`);
  await screenshot('02-asistente-disenos');
  const chosen = await evaluate(`(()=>{const a=[...document.querySelectorAll('[data-testid="design-gallery"] article')][0];const b=[...a.querySelectorAll('button')].find(x=>x.textContent.trim()==='Elegir');if(!b)return null;b.click();return a.querySelector('h3').textContent.trim()})()`);
  await wait(`[...document.querySelectorAll('[data-testid="design-gallery"] article button')].some(n=>n.textContent.trim()==='Elegido')`, 10_000, 'diseno elegido');
  await clickText('Continuar');
  await wait(`!!document.querySelector('[role="dialog"] [data-business-renderer]')`, 30_000, 'vista previa completa');
  await sleep(2500);
  await screenshot('03-asistente-preview-diseno');
  await clickText('Elegir este dise\u00f1o');
  await wait(`document.body.innerText.includes('Nombre del negocio')`, 15_000, 'datos del negocio');
  await fillLabel('Nombre del negocio', B.name);
  await fillLabel('Descripci\u00f3n', B.description);
  await fillLabel('Tel\u00e9fono', B.phone);
  await fillLabel('WhatsApp', B.whatsapp);
  await fillLabel('Email', B.email);
  await fillLabel('Direcci\u00f3n', B.address);
  await fillLabel('Ciudad', B.city);
  await fillLabel('Redes', B.socials);
  await fillLabel('Bot\u00f3n principal', B.cta);
  await screenshot('04-asistente-datos');
  await clickText('Continuar');
  await wait(`document.body.innerText.includes('Paso 5 de 5')`, 10_000, 'revision');
  await screenshot('05-asistente-revision');
  await clickText('Crear p\u00e1gina');
  await wait(`location.pathname==='/negocio/editor' && new URLSearchParams(location.search).get('id')`, 40_000, 'editor abierto tras crear');
  businessId = await evaluate(`new URLSearchParams(location.search).get('id')`);
  await wait(`!!document.querySelector('[data-testid="business-builder"] [data-business-renderer]')`, 40_000, 'render del editor');
  await sleep(2000);
  const business = await apiGet(`/api/businesses/${businessId}`);
  slug = business?.body?.business?.slug || '';
  return { businessId, slug, rubro: 'PET / Cuidado de mascotas (Veterinaria)', disenoElegido: chosen, disenosDisponibles: designs };
}


/* 3) V3 legacy design -> Manifest V2 -> Site Instance V2 -> Editor V2 */
async function verifyChain() {
  const site = await apiGet(`/api/template-engine/${businessId}/site-instance`);
  const instance = site?.body?.instance;
  const business = await apiGet(`/api/businesses/${businessId}`);
  const b = business?.body?.business;
  const manifest = instance?.manifest;
  const secciones = Array.isArray(manifest?.sections) ? manifest.sections : [];
  const chain = {
    plantillaV3Legacy: b?.template?.code || null,
    siteInstanceId: instance?.id || null,
    manifestVersion: instance?.manifestVersion ?? null,
    legacyCompatibility: instance?.legacyCompatibility ?? null,
    manifestLegacyFlag: manifest?.legacy ?? null,
    manifestEsV2Real: secciones.length > 0,
    secciones: secciones.length,
    bloques: secciones.reduce((acc, s) => acc + (Array.isArray(s.blocks) ? s.blocks.length : 0), 0),
    bloquesDelManifest: Array.from(new Set(secciones.flatMap((s) => (s.blocks || []).map((x) => x.block)))),
    rendererEnEditor: await evaluate(`document.querySelector('[data-testid="business-builder"] [data-business-renderer]')?.getAttribute('data-business-renderer')||''`),
    engineV2EnEditor: Boolean(await evaluate(`!!document.querySelector('[data-testid="business-builder"] [data-template-engine="v2"]')`)),
    sidebarDesdeManifest: await listSections(),
    visualSections: Array.isArray(b?.visual?.sections) ? b.visual.sections.length : 0,
    visualSectionsValor: b?.visual?.sections ?? null,
  };
  report.evidencia.cadena = chain;
  await screenshot('06-editor-v2');
  if (!chain.siteInstanceId) throw new Error('STOP CONDITION: SiteInstance inexistente despues de crear la pagina');
  if (!chain.manifestEsV2Real) throw new Error('STOP CONDITION: el manifest no es V2 real (sin secciones)');
  if (chain.rendererEnEditor !== 'v2' || !chain.engineV2EnEditor) throw new Error('El editor no compone con el motor V2');
  return chain;
}

/* 4) Contenido + secciones disponibles (todo por el manifest) */
async function editContent() {
  const antes = await listSections();
  const titulo = `${B.name} \u00b7 Osorno`;
  if (!(await selectHeroSection())) throw new Error('No se encontro la seccion Portada en el editor');
  await sleep(900);
  await fillLabel('T\u00edtulo', titulo);
  await sleep(500);
  await fillLabel('Descripci\u00f3n', `${B.description} Urgencias 24/7.`);
  await sleep(500);
  await fillLabel('Bot\u00f3n principal', B.cta);
  await sleep(500);
  await fillLabel('Acci\u00f3n', 'WHATSAPP');
  await sleep(3000);
  const texto = await previewText();
  const agregadas = [];
  for (const cap of ['FAQ', 'TESTIMONIALS', 'TEAM', 'GALLERY', 'CTA', 'MAP', 'OPENING_HOURS', 'SOCIALS', 'BOOKING']) {
    const abrio = await evaluate(`(()=>{const b=document.querySelector('[data-testid="builder-add-section"]');if(!b)return false;b.click();return true})()`);
    if (!abrio) break;
    await wait(`!!document.querySelector('[role="dialog"][aria-label="Agregar secci\u00f3n"]')`, 10_000, 'selector de secciones');
    const dialogo = await evaluate(`(()=>{const d=document.querySelector('[role="dialog"][aria-label="Agregar secci\u00f3n"]');return {disponibles:[...d.querySelectorAll('[data-testid^="builder-addable-"]')].map(n=>n.getAttribute('data-testid').replace('builder-addable-','')), texto:d.innerText.slice(0,200)}})()`);
    const elegida = await evaluate(`(()=>{const n=document.querySelector('[data-testid="builder-addable-${cap}"]');if(!n)return null;n.click();return (n.querySelector('strong')?.textContent||'ok').trim()})()`);
    if (!elegida) {
      await evaluate(`(()=>{const d=document.querySelector('[role="dialog"][aria-label="Agregar secci\u00f3n"]');const b=d?.querySelector('button[aria-label="Cerrar"]');if(b)b.click();return true})()`);
    }
    await sleep(2500);
    const lista = await listSections();
    agregadas.push({ cap, disponibleEnDialogo: dialogo.disponibles.includes(cap), elegida, totalSecciones: lista.length, nota: elegida ? 'AGREGADA' : 'ya estaba en el manifest (no la ofrece el dialogo)' });
  }
  await sleep(2500);
  const despues = await listSections();
  const site = await apiGet(`/api/template-engine/${businessId}/site-instance`);
  const seccionesManifest = site?.body?.instance?.manifest?.sections || [];
  return {
    seccionesAntes: antes.length,
    seccionesDespues: despues.length,
    lista: despues,
    agregadas,
    manifestSecciones: seccionesManifest.length,
    manifestCapacidades: Array.from(new Set(seccionesManifest.flatMap((s) => (s.blocks || []).map((x) => x.block)))),
    heroVisibleEnPreview: texto.includes(titulo),
    ctaVisible: texto.includes(B.cta),
  };
}


/* 5) Imagen REAL: upload UI -> URL publica -> editor */
async function uploadRealImage() {
  const info = await stat(REAL_IMAGE);
  if (!info.size) throw new Error('El archivo de imagen de prueba esta vacio');
  await go(`${base}/negocio/configuracion?id=${businessId}`);
  await wait(`!!document.querySelector('input[type="file"]')`, 30_000, 'inputs de imagen de marca');
  const antes = await evaluate(`document.querySelector('img[alt="Portada"]')?.getAttribute('src')||''`);
  const inputs = await setFiles('input[type="file"]', [REAL_IMAGE], 1);
  await wait(`!!document.querySelector('img[alt="Portada"]')?.getAttribute('src')`, 40_000, 'portada subida');
  await sleep(2000);
  const url = await evaluate(`document.querySelector('img[alt="Portada"]')?.getAttribute('src')||''`);
  const publica = await evaluate(`(async()=>{try{const r=await fetch(${JSON.stringify(url)});return {status:r.status,type:r.headers.get('content-type')}}catch(e){return {status:0,error:String(e)}}})()`);
  await screenshot('07-imagen-subida');
  await go(`${base}/negocio/editor?id=${businessId}`);
  await wait(`!!document.querySelector('[data-testid="business-builder"] [data-business-renderer]')`, 40_000, 'editor');
  await sleep(2000);
  if (!(await selectHeroSection())) throw new Error('No se encontro la seccion Portada para asignar la imagen');
  await sleep(900);
  await fillLabel('Imagen', url);
  await sleep(4000);
  const imgsPreview = await previewImages();
  return {
    archivo: path.basename(REAL_IMAGE),
    bytes: info.size,
    inputsDeArchivoEnPanel: inputs,
    portadaAntes: antes || null,
    urlPublica: url,
    httpStatus: publica.status,
    contentType: publica.type,
    urlEnPreviewDelEditor: imgsPreview.includes(url),
    estadoGuardado: await builderState(),
  };
}

/* 6) Guardar + F5: imagen y cambios sobreviven */
async function reloadAndVerify() {
  await evaluate(`document.querySelector('[data-testid="builder-save"]').click()`);
  await sleep(3500);
  const antes = { estado: await builderState(), secciones: (await listSections()).length };
  await send('Page.reload', { ignoreCache: true });
  await wait(`!!document.querySelector('[data-testid="business-builder"] [data-business-renderer]')`, 40_000, 'editor tras F5');
  // Tras el F5 el editor vuelve a pedir manifest + contenido: se espera a que la
  // estructura (sidebar) y el hero estén repintados antes de medir.
  await wait(`document.querySelectorAll('[data-testid="builder-sidebar"] [data-testid^="builder-section-select-"]').length>0`, 40_000, 'sidebar repintada tras F5');
  await wait(`!!document.querySelector('[data-testid="business-builder"] [data-template-engine="v2"] [data-block-id="Hero"]')`, 40_000, 'hero repintado tras F5');
  await sleep(2500);
  const imgs = await previewImages();
  const texto = await previewText();
  const secciones = await listSections();
  const site = await apiGet(`/api/template-engine/${businessId}/site-instance`);
  const instance = site?.body?.instance;
  const rev = await apiGet(`/api/template-engine/${businessId}/site-instance/revisions`);
  const b = (await apiGet(`/api/businesses/${businessId}`))?.body?.business;
  const rotas = await evaluate(`[...document.querySelectorAll('[data-testid="business-builder"] [data-business-renderer] img')].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'))`);
  return {
    estadoAntesDeF5: antes.estado,
    seccionesAntesDeF5: antes.secciones,
    seccionesDespuesDeF5: secciones.length,
    secciones,
    imagenesEnPreview: imgs.length,
    imagenesPublicas: imgs.filter((u) => u && /^https?:/i.test(u)),
    imagenesRotas: rotas,
    ctaVisibleTrasF5: texto.includes(B.cta),
    siteInstanceId: instance?.id,
    manifestVersion: instance?.manifestVersion,
    manifestSecciones: (instance?.manifest?.sections || []).length,
    manifestCapacidades: Array.from(new Set((instance?.manifest?.sections || []).flatMap((s) => (s.blocks || []).map((x) => x.block)))),
    revisiones: (rev?.body?.revisions || []).length,
    businessCover: b?.cover || null,
    businessCta: b?.cta || null,
  };
}


/* 7) Undo / Redo + recarga */
async function undoRedo() {
  const valorA = `${B.name} \u00b7 Osorno`;
  const valorB = `${B.name} \u00b7 Urgencias 24/7`;
  const leer = () => evaluate(`(()=>{const n=document.querySelector('[data-testid="builder-name-input"]');return n?n.value:''})()`);
  if (!(await selectHeroSection())) throw new Error('No se encontro la seccion Portada para la prueba de undo/redo');
  await sleep(1000);
  const inicial = await leer();
  await fillLabel('T\u00edtulo', valorB);
  await sleep(3000);
  const trasEditar = await leer();
  const undoHabilitado = await evaluate(`!document.querySelector('[data-testid="builder-undo"]').disabled`);
  await evaluate(`document.querySelector('[data-testid="builder-undo"]').click()`);
  await sleep(3000);
  const trasUndo = await leer();
  const redoHabilitado = await evaluate(`!document.querySelector('[data-testid="builder-redo"]').disabled`);
  await evaluate(`document.querySelector('[data-testid="builder-redo"]').click()`);
  await sleep(3000);
  const trasRedo = await leer();
  await evaluate(`document.querySelector('[data-testid="builder-save"]').click()`);
  await sleep(3500);
  await send('Page.reload', { ignoreCache: true });
  await wait(`!!document.querySelector('[data-testid="business-builder"] [data-business-renderer]')`, 40_000, 'editor tras F5 post undo/redo');
  await wait(`!!document.querySelector('[data-testid="builder-name-input"]')`, 40_000, 'inspector repintado tras F5');
  await sleep(2500);
  const trasRecarga = await leer();
  const site = await apiGet(`/api/template-engine/${businessId}/site-instance`);
  const rev = await apiGet(`/api/template-engine/${businessId}/site-instance/revisions`);
  const b = (await apiGet(`/api/businesses/${businessId}`))?.body?.business;
  const heroManifest = (site?.body?.instance?.manifest?.sections || []).find((s) => (s.blocks || []).some((x) => x.block === 'Hero'));
  return {
    valorInicial: inicial,
    esperadoTrasUndo: valorA,
    esperadoTrasRedo: valorB,
    trasEditar,
    undoHabilitado,
    trasUndo,
    undoRestauro: trasUndo === valorA,
    redoHabilitado,
    trasRedo,
    redoRecupero: trasRedo === valorB,
    trasRecarga,
    coincideConEsperado: trasRecarga === valorB,
    businessNamePersistido: b?.name || null,
    heroManifestConfig: heroManifest?.blocks?.[0]?.config ?? null,
    revisiones: (rev?.body?.revisions || []).length,
  };
}


/* 8) Veterinaria: servicios + productos + testimonios/FAQ/equipo */
async function panelContent() {
  await go(`${base}/negocio/servicios?id=${businessId}`);
  await wait(`!!document.querySelector('input[placeholder*="Nombre del servicio"]')`, 30_000, 'panel de servicios');  for (const s of SERVICES) {
    await fillPlaceholder('Nombre del servicio', s.name);
    await fillPlaceholder('Descripci\u00f3n', s.description);
    await fillPlaceholder('Precio (CLP)', s.price);
    await fillPlaceholder('Duraci\u00f3n (min)', s.duration);
    const antes = await evaluate(`document.querySelectorAll('ul li').length`);
    await wait(`[...document.querySelectorAll('form button')].some(b=>(b.textContent||'').trim()==='Agregar servicio' && !b.disabled)`, 40_000, 'formulario de servicios listo');
    await clickExact('Agregar servicio', 'form button');
    await wait(`document.querySelectorAll('ul li').length>${antes}`, 30_000, `servicio guardado: ${s.name}`);
    await sleep(600);
  }
  const servicios = await evaluate(`document.querySelectorAll('ul li').length`);
  await go(`${base}/negocio/productos?id=${businessId}`);
  await wait(`document.body.innerText.includes('Cat\u00e1logo de tu negocio')`, 30_000, 'panel de productos');
  for (const p of PRODUCTS) {
    await fillPlaceholder('Nombre *', p.name);
    await fillPlaceholder('Descripci\u00f3n corta', p.short);
    await fillPlaceholder('Precio *', p.price);
    await fillPlaceholder('Categor\u00eda', p.category);
    await sleep(400);
    const antes = await evaluate(`document.querySelectorAll('ul li').length`);
    await wait(`[...document.querySelectorAll('form button')].some(b=>(b.textContent||'').trim()==='Agregar producto' && !b.disabled)`, 40_000, 'formulario de productos listo');
    await clickExact('Agregar producto', 'form button');
    await wait(`document.querySelectorAll('ul li').length>${antes}`, 30_000, `producto guardado: ${p.name}`);
    await sleep(600);
  }
  const productos = await evaluate(`document.querySelectorAll('ul li').length`);
  await go(`${base}/negocio/contenido?id=${businessId}`);
  await wait(`document.body.innerText.includes('Contenido de tu p\u00e1gina')`, 30_000, 'panel de contenido');
  const tabs = [
    ['Testimonios', TESTIMONIALS, (t) => ({ Nombre: t.name, Cargo: t.role, Testimonio: t.content })],
    ['Preguntas', FAQS, (f) => ({ Pregunta: f.question, Respuesta: f.answer })],
    ['Equipo', TEAM, (m) => ({ Nombre: m.name, Rol: m.role, Presentaci\u00f3n: m.bio })],
  ];
  const agregaEnPanel = async (nombres, etiquetaBoton) => {
    const antes = await evaluate(`document.querySelectorAll('ul li').length`);
    // El botón vuelve a su etiqueta solo cuando el guardado anterior terminó.
    await wait(`[...document.querySelectorAll('form button')].some(b=>(b.textContent||'').trim()===${JSON.stringify(etiquetaBoton)} && !b.disabled && b.offsetParent!==null)`, 40_000, `formulario listo: ${etiquetaBoton}`);
    await clickExact(etiquetaBoton, 'form button');
    await wait(`document.querySelectorAll('ul li').length>${antes}`, 40_000, `item guardado: ${etiquetaBoton}`);
    await sleep(900);
    return evaluate(`document.querySelectorAll('ul li').length`);
  };
  for (const [tab, items, campos] of tabs) {
    await clickText(tab, '[role="tab"]');
    await sleep(900);
    for (const item of items) {
      for (const [label, value] of Object.entries(campos(item))) await fillLabel(label, value);
      await agregaEnPanel([item], 'Agregar');
    }
  }
  const content = await apiGet(`/api/businesses/${businessId}/content`);
  const extras = {
    testimonios: (content?.body?.testimonials || []).length,
    faqs: (content?.body?.faqs || []).length,
    equipo: (content?.body?.team || []).length,
  };  await screenshot('08-panel-contenido');
  await go(`${base}/negocio/editor?id=${businessId}`);
  await wait(`!!document.querySelector('[data-testid="business-builder"] [data-business-renderer]')`, 40_000, 'editor');
  await sleep(3500);
  const texto = await previewText();
  const secciones = await listSections();
  const bloque = (id) => evaluate(`!!document.querySelector('[data-testid="business-builder"] [data-block-id="${id}"]')`);
  const ctaTextos = await evaluate(`[...document.querySelectorAll('[data-testid="business-builder"] [data-business-renderer] a, [data-testid="business-builder"] [data-business-renderer] button')].map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,12)`);
  return {
    servicios, productos, ...extras,
    serviciosVisibles: SERVICES.every((s) => texto.includes(s.name)),
    productosVisibles: PRODUCTS.every((p) => texto.includes(p.name)),
    bloqueServicios: await bloque('Services'),
    bloqueProductos: await bloque('Products'),
    bloqueCatalog: await bloque('Catalog'),
    bloqueTestimonios: await bloque('Testimonials'),
    bloqueFaq: await bloque('FAQ'),
    bloqueEquipo: await bloque('Team'),
    seccionesEnSidebar: secciones,
    ctaConfiguradoVisible: texto.includes(B.cta),
    ctaTextosRenderizados: ctaTextos,
  };
}


/* 9) Responsive real: 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 */
const WIDTHS = [375, 390, 430, 768, 1024, 1280, 1440];
async function responsive(url) {
  const out = [];
  for (const width of WIDTHS) {
    await viewport(width, 900);
    await go(url);
    // La pagina de vista previa pide datos al backend: se espera el render real,
    // no un esqueleto de carga.
    await wait(`!!document.querySelector('[data-business-renderer]')`, 30_000, `render en ${width}px`);
    await sleep(4000);
    const m = await evaluate(`(()=>{const d=document.documentElement;const imgs=[...document.images];const wide=[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>window.innerWidth+2).slice(0,6).map(n=>n.tagName+'.'+String(n.className||'').slice(0,48));const cortadas=[...document.querySelectorAll('section,header,footer')].filter(n=>n.getBoundingClientRect().height>0&&n.scrollWidth>n.clientWidth+2).slice(0,4).map(n=>n.tagName);const botones=[...document.querySelectorAll('a,button')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.right>window.innerWidth+2||r.left<-2)}).slice(0,4).map(n=>(n.textContent||'').trim().slice(0,30));return {ancho:window.innerWidth,scrollWidth:d.scrollWidth,overflowHorizontal:d.scrollWidth>window.innerWidth+1,alto:d.scrollHeight,imagenes:imgs.length,imagenesRotas:imgs.filter(i=>i.complete&&i.naturalWidth===0).length,desbordeDerecha:wide,seccionesCortadas:cortadas,botonesFueraDePantalla:botones,renderer:document.querySelector('[data-business-renderer]')?.getAttribute('data-business-renderer')||'',bloques:document.querySelectorAll('[data-block-id]').length}})()`);
    out.push(m);
    await screenshot(`resp-${width}`);
  }
  await send('Emulation.clearDeviceMetricsOverride');
  return out;
}

/* 10) Publicacion: se intenta y se registra tal cual */
async function publicar() {
  await go(`${base}/negocio/editor?id=${businessId}`);
  await wait(`!!document.querySelector('[data-testid="business-builder"] [data-business-renderer]')`, 40_000, 'editor');
  await sleep(2000);
  const boton = await evaluate(`(()=>{const b=document.querySelector('[data-testid="builder-publish"]');if(!b)return false;b.click();return true})()`);
  await sleep(6000);
  const alertas = await evaluate(`[...document.querySelectorAll('[role="alert"]')].map(n=>n.innerText.trim()).filter(Boolean)`);
  const texto = alertas.join(' | ');
  const b = (await apiGet(`/api/businesses/${businessId}`))?.body?.business;
  const gate = /suscripci\u00f3n activa/i.test(texto);
  return {
    botonPublicado: boton,
    mensajeUI: alertas,
    gateDeSuscripcion: gate,
    statusNegocio: b?.status,
    resultado: gate ? 'PUBLICATION = BLOCKED_EXTERNAL_DEPENDENCY' : 'PUBLICADO_SIN_GATE',
  };
}


async function main() {
  await mkdir(captures, { recursive: true });
  const heartbeat = setInterval(() => { try { writeFileSync(path.join(captures, 'report.json'), JSON.stringify({ ...report, stage, now: new Date().toISOString() }, null, 2)); } catch { /* ignore */ } }, 8_000);
  process.on('exit', () => clearInterval(heartbeat));
  const launched = await launchChromeIsolated();
  chrome = launched.chrome;
  client = new CDP(launched.target.webSocketDebuggerUrl, { runId });
  await client.open();
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
  await viewport(1440, 1000);
  await step('1) registro de usuario por la UI real', registerThroughUi);
  const creado = await step('2) asistente: rubro Veterinaria + diseno + datos + Crear pagina', wizard);
  if (!creado) { report.status = 'ABORTADO_EN_CREACION'; return; }
  const cadena = await step('3) cadena V3 legacy -> Manifest V2 -> SiteInstance V2 -> Editor V2', verifyChain);
  if (!cadena) { report.status = 'ABORTADO_SITIO_AUSENTE'; return; }
  await step('4) edicion de contenido y de secciones en el editor', editContent);
  const imagen = await step('5) imagen REAL: upload UI -> URL publica -> editor', uploadRealImage);
  const recarga = await step('6) guardar + F5: sobreviven imagen y cambios', reloadAndVerify);
  const ur = await step('7) Undo / Redo + recarga', undoRedo);
  const contenido = await step('8) Veterinaria: servicios + productos + testimonios/FAQ/equipo', panelContent);
  const urlPreview = `${base}/mi-negocio/${slug}?preview=true`;
  report.evidencia.urlPreview = urlPreview;
  report.responsive = (await step('9) responsive 375/390/430/768/1024/1280/1440', () => responsive(urlPreview))) || [];
  const publicacion = await step('10) intento de publicacion', publicar);
  report.evidencia.imagen = imagen;
  report.evidencia.recarga = recarga;
  report.evidencia.undoRedo = ur;
  report.evidencia.contenido = contenido;
  report.evidencia.publicacion = publicacion;
  if (publicacion?.gateDeSuscripcion) report.limites.push('PUBLICATION = BLOCKED_EXTERNAL_DEPENDENCY (gate de suscripcion de Mercado Pago).');
  const fallos = report.pasos.filter((p) => p.status === 'FALLO').map((p) => p.name);
  report.status = fallos.length ? 'CON_FALLOS' : 'COMPLETADO';
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(captures, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nREPORTE:', path.join(captures, 'report.json'));
}

main()
  .catch(async (error) => {
    report.status = 'ERROR';
    report.problemas.push({ paso: stage, error: String(error?.message || error).slice(0, 800) });
    try { await writeFile(path.join(captures, 'report.json'), JSON.stringify(report, null, 2)); } catch { /* ignore */ }
    console.error('ERROR GLOBAL:', error);
  })
  .finally(async () => {
    try { client?.close(); } catch { /* ignore */ }
    try { chrome?.kill(); } catch { /* ignore */ }
    process.exit(0);
  });

