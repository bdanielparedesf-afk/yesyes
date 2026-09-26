/**
 * FASE B-D — Crear una pagina REAL de RESTAURANTE por la UI.
 *
 * Todo se hace con la interfaz: registro, asistente. No se escribe en la base
 * de datos ni se llama a endpoints internos. El token se lee del localStorage
 * SOLO para hacer GETs de verificacion.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { APP, Page, launchBrowser, sleep } from './driver.mjs';

const runId = process.env.RUN_ID || `cert-${Date.now()}`;
const SHOTS = path.resolve('qa/cert-captures', runId);
const report = { runId, startedAt: new Date().toISOString(), pasos: [], fallos: [], business: null };
const paso = (n, ok, detalle) => {
  report.pasos.push({ n, ok, detalle });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n} :: ${detalle}`);
  if (!ok) report.fallos.push(`${n} :: ${detalle}`);
};

export const B = {
  name: 'Casa Aurora',
  description: 'Restaurante de cocina chilena contemporanea en el corazon de Providencia. Menu de temporada, carta de vinos y reservas con vista al jardin.',
  phone: '+56 9 8765 4321',
  whatsapp: '+56 9 8765 4321',
  email: 'hola@casaaurora.cl',
  address: 'Av. Providencia 1234, Santiago',
  city: 'Santiago',
  socials: 'https://instagram.com/casaaurora, https://facebook.com/casaaurora',
  cta: 'Reservar mesa',
};

export async function registrar(page, email, pass = 'Certificacion2026!') {
  await page.goto(`${APP}/register`, { waitMs: 2000 });
  await page.fill('input[placeholder="Tu nombre"]', 'Certificacion');
  await page.fill('input[placeholder="Tu apellido"]', 'QA');
  await page.fill('input[placeholder="tu@email.com"]', email);
  const n = await page.eval(`document.querySelectorAll('input[type="password"]').length`);
  if (n < 2) { paso('B1-registro', false, 'No hay 2 campos de contrasena en /register'); return null; }
  await page.eval(`(() => {
    const inputs = [...document.querySelectorAll('input[type="password"]')];
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const input of inputs) {
      proto.call(input, ${JSON.stringify(pass)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  const submitted = await page.clickText('Crear cuenta', { selector: 'button[type="submit"]' })
    || await page.clickText('Crear cuenta', { selector: 'button' });
  if (!submitted) { paso('B1-registro', false, 'No se encontro el boton de registro'); return null; }
  // El registro responde 201 y la app navega a "/" cuando la sesion queda activa.
  const deadline = Date.now() + 30_000;
  let token = null;
  while (Date.now() < deadline && !token) {
    token = await page.eval(`(() => { try { const s = JSON.parse(localStorage.getItem('yesyes-auth') || '{}'); return s?.state?.token || s?.token || null; } catch { return null; } })()`);
    if (!token) await sleep(500);
  }
  if (!token) { paso('B1-registro', false, 'El registro no dejo sesion activa'); return null; }
  paso('B1-registro', true, `Cuenta creada por la UI con sesion activa (${email})`);
  return token;
}


async function finish(child, page, extra = {}) {
  try { await page.screenshot(SHOTS, 'zz-final'); } catch { /* noop */ }
  Object.assign(report, extra);
  report.finishedAt = new Date().toISOString();
  await writeFile(path.resolve('qa/cert-phase-bd.json'), JSON.stringify(report, null, 2));
  // La pagina creada se deja registrada para que las fases siguientes sigan
  // trabajando sobre ESTA misma pagina real, no sobre una nueva cada corrida.
  if (extra.business) {
    await writeFile(path.resolve('qa/cert-negocio.json'), JSON.stringify({ ...extra.business, runId }, null, 2));
    console.log(`\nNegocio para fases siguientes: ${extra.business.id}`);
  }
  console.log('\n--- RESUMEN FASE B-D ---');
  console.log(`pasos: ${report.pasos.length}  fallos: ${report.fallos.length}`);
  if (report.fallos.length) console.log(report.fallos.join('\n'));
  page.close();
  child.kill();
  process.exit(report.fallos.length ? 1 : 0);
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const { child, target, port } = await launchBrowser({ runId, port: 9711 });
  const page = await Page.create(target);
  try {
    const email = `cert-${Date.now()}@example.invalid`;
    const token = await registrar(page, email);
    if (!token) return finish(child, page);

    await page.goto(`${APP}/negocio/nuevo`, { waitMs: 3000 });
    await page.screenshot(SHOTS, 'C1-asistente-rubro');
    const eligioRubro = await page.clickText('Restaurante', { selector: 'button' });
    paso('C1-rubro', eligioRubro, 'Rubro Restaurante elegido en el asistente');
    await sleep(2500);

    // Elegir el rubro NO avanza de paso: hay que pulsar Continuar para llegar a
    // la galería de diseños.
    await page.clickText('Continuar', { selector: 'main button', exact: false });
    await sleep(3000);
    await page.screenshot(SHOTS, 'C2-disenos');

    const pasoActual = await page.eval(`document.querySelector('main h2')?.innerText || ''`);
    const designCount = await page.eval(`document.querySelectorAll('[data-testid="design-gallery"] > *').length`);
    paso('C2-galeria', designCount >= 3, `Galeria de "${pasoActual}" ofrece ${designCount} disenos`);

    const chips = await page.eval(`[...document.querySelectorAll('[data-testid="design-gallery"] li')].map((n) => (n.innerText || '').trim())`);
    paso('C2b-etiquetas', chips.length > 0 && !chips.every((c) => c === 'Sección'),
      `Chips de funciones legibles: ${JSON.stringify([...new Set(chips)])}`);

    // Selecciona el SEGUNDO diseño (Diseño B) para probar el cambio de diseño.
    const elegio = await page.eval(`(() => {
      const buttons = [...document.querySelectorAll('[data-testid="design-gallery"] button')].filter((b) => /Elegir/i.test(b.innerText || ''));
      if (buttons.length < 2) return null;
      buttons[1].click();
      return buttons[1].closest('div')?.parentElement?.innerText?.split('\\n')[1] || 'diseno B';
    })()`);
    paso('C2c-diseno-elegido', Boolean(elegio), `Diseno B elegido en la galeria: ${elegio}`);
    await sleep(1500);

    // Paso 2 -> 3 (vista previa completa del diseño elegido)
    await page.clickText('Continuar', { selector: 'main button', exact: false });
    await sleep(3500);
    await page.screenshot(SHOTS, 'C3-vista-previa-completa');
    const previewText = await page.text('main');
    paso('C3-preview-diseno', previewText.length > 200,
      `Vista previa completa del diseno abierta (${previewText.length} caracteres renderizados)`);

    // Paso 3 -> 4 (informacion basica)
    await page.clickText('Continuar', { selector: 'main button', exact: false });
    await sleep(2000);
    await page.screenshot(SHOTS, 'C4-informacion');

    // El asistente usa <label>{texto}<input/></label>: se busca el label cuyo
    // texto empieza con la clave y se escribe en el control que contiene.
    const filled = await page.eval(`(() => {
      const wanted = ${JSON.stringify([
        ['Nombre del negocio', B.name], ['Descripci', B.description], ['Tel', B.phone],
        ['WhatsApp', B.whatsapp], ['Email', B.email], ['Direcci', B.address],
        ['Ciudad', B.city], ['Redes', B.socials], ['Bot', B.cta],
      ])};
      const labels = [...document.querySelectorAll('main label')];
      const done = [];
      for (const [prefix, value] of wanted) {
        const label = labels.find((l) => (l.childNodes[0]?.textContent || '').trim().toLowerCase().startsWith(prefix.toLowerCase()));
        const field = label && (label.querySelector('input, textarea'));
        if (!field) continue;
        const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        done.push(prefix);
      }
      return done;
    })()`);
    paso('D0-formulario', filled.length >= 8, `${filled.length}/9 campos de informacion comercial rellenados: ${filled.join(', ')}`);
    await sleep(800);
    await page.screenshot(SHOTS, 'C5-formulario-relleno');

    // Paso 3 -> 4 (revision) y creacion
    await page.clickText('Continuar', { selector: 'main button', exact: false });
    await sleep(1500);
    await page.screenshot(SHOTS, 'C6-revision');
    // "Crear página" debe matchear EXACTO: con coincidencia parcial el botón
    // "Continuar" (que no la contiene) o "Creando..." se colgaban antes.
    const creada = await page.clickText('Crear página', { selector: 'main button', exact: true })
      || await page.clickText('Crear', { selector: 'main button', exact: true });
    // Se espera a la navegación real (no a un reloj fijo).
    const deadline = Date.now() + 30_000;
    let url = await page.url();
    while (Date.now() < deadline && !url.includes('/negocio/editor')) {
      await sleep(700);
      url = await page.url();
    }
    const negocioId = new URL(url).searchParams.get('id') || '';
    if (!negocioId) {
      const alert = await page.eval(`document.querySelector('[role="alert"]')?.innerText || '(sin alerta)'`);
      const botones = await page.eval(`[...document.querySelectorAll('main button')].map((b) => ({ t: (b.innerText || '').trim(), disabled: b.disabled }))`);
      paso('D1-diagnostico', false, `sin navegar a /negocio/editor. alerta=${alert} botones=${JSON.stringify(botones)}`);
      paso('D1-consola', false, `consola: ${JSON.stringify(page.consoleErrors.slice(0, 4))} | erroresJS: ${JSON.stringify(page.pageErrors.slice(0, 3))}`);
      paso('D1-red', false, `red: ${JSON.stringify(page.failedRequests.slice(0, 5))}`);
      await page.screenshot(SHOTS, 'C7-error-crear');
    }
    paso('D1-pagina-creada', Boolean(negocioId) && url.includes('/negocio/editor'),
      `Negocio creado por la UI. id=${negocioId} url=${url}`);
    if (!negocioId) return finish(child, page);

    // Las 6 llamadas del editor tardan ~5s: se espera al elemento real, no a un
    // reloj fijo (si no, la QA miente sobre un editor que solo va lento).
    const abrio = await page.waitFor('[data-testid="business-builder"]', 45_000);
    await page.screenshot(SHOTS, 'D2-editor');
    const diag = await page.eval(`({
      url: location.href,
      main: (document.querySelector('main') || {}).innerText?.slice(0, 160),
      testids: [...document.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid')).slice(0, 20),
    })`);
    paso('D2-editor-abre', abrio, `El editor V2 abrio tras crear la pagina. diag=${JSON.stringify(diag)}`);

    // Se guarda la sesión del navegador (localStorage) para que las fases
    // siguientes abran el MISMO negocio sin volver a registrarse. Es la sesión
    // real creada por la UI, no un token fabricationdo.
    const storage = await page.eval(`Object.fromEntries(Object.entries(localStorage))`);
    const secciones = await page.eval(`document.querySelectorAll('[data-testid^="builder-section-"]').length`);
    paso('D2-secciones', secciones > 0, `El editor lista ${secciones} secciones del manifest V2`);
    paso('D2-console', page.consoleErrors.length === 0, `errores de consola: ${JSON.stringify(page.consoleErrors.slice(0, 5))}`);
    paso('D2-failed', page.failedRequests.filter((r) => r.url.includes('/api/')).length === 0,
      `requests fallidas: ${JSON.stringify(page.failedRequests.slice(0, 6))}`);
    return finish(child, page, { business: { id: negocioId, url, name: B.name, email, token, storage } });
  } catch (error) {
    paso('ERROR', false, String(error && error.message ? error.message : error));
    return finish(child, page);
  }
}

// Solo se ejecuta cuando este archivo es el entrypoint. Otros scripts de QA
// importan `registrar` sin querer disparar la corrida completa.
if (process.argv[1] && process.argv[1].endsWith('phase-bd.mjs')) main();
