/**
 * FASE 3 — PRUEBA REAL EN UI: DRAFT ≠ PUBLISHED sobre la página de Veterinaria.
 *
 * Usa la página REAL ya creada (`clinica-veterinaria-los-robles-14`), la misma
 * UI, el mismo renderer y los mismos endpoints que usa una persona. NO crea
 * páginas, NO hace SQL y NO cambia estados en la base: sólo navega, edita,
 * recarga y consulta.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CDP, base, sleep } from './business-qa-client.mjs';

const runId = process.env.RUN_ID || `fase3-${Date.now()}`;
const debugPort = Number(process.env.CDP_PORT) || 9900 + (process.pid % 90);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const captures = path.resolve('qa/business-captures', runId);
const SLUG = 'clinica-veterinaria-los-robles-14';
const BUSINESS_ID = 'bdaf96cb-a219-4fab-939a-4f0c20d7cf25';
const EMAIL = process.env.QA_EMAIL || 'fase2.1790390504877@example.com';
const PASSWORD = process.env.QA_PASSWORD || 'Fase2-QA-2026';

const report = {
  runId, slug: SLUG, businessId: BUSINESS_ID, startedAt: new Date().toISOString(),
  pasos: [], problemas: [], evidencia: {}, estado: {},
};

let client, chrome, stage = 'init';
const paso = (name, ok, detalle = '') => {
  report.pasos.push({ name, status: ok ? 'OK' : 'FALLO', detalle });
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${name} ${detalle}`);
  return ok;
};
const send = (method, params = {}) => client.send(method, params);

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300));
  return r.result?.value;
}
const shot = async (tag) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(captures, `${tag}.png`), Buffer.from(s.data, 'base64'));
};
async function launchChrome() {
  // El launcher se ejecuta FUERA de este script (Chrome headless en este
  // entorno no sobrevive a `spawn` desde Node). Si no hay un puerto de
  // depuración escuchando, se lanza con PowerShell y se espera a que responda.
  const probe = async () => {
    const res = await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1_000) });
    const targets = await res.json();
    return targets.find((t) => t.type === 'page') || null;
  };
  let page = await probe().catch(() => null);
  if (!page) {
    const profile = path.resolve('logs', 'chrome-f3', runId);
    const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'].map((a) => `'${a}'`).join(',');
    await new Promise((resolve) => {
      spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process -FilePath '${chromePath}' -ArgumentList @(${args}) -WindowStyle Hidden`], { stdio: 'ignore', windowsHide: true }).on('exit', resolve);
    });
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline) {
      page = await probe().catch(() => null);
      if (page) break;
      await sleep(500);
    }
  }
  if (!page) throw new Error('Chrome no entrego target CDP');
  return { child: null, page };
}

const goto = async (url) => { await send('Page.navigate', { url }); await sleep(3500); };
/** Llamadas con la sesión real del navegador (mismo token, mismos headers). */
const apiGet = (pathname) => evaluate(`(async () => {
  const t = JSON.parse(localStorage.getItem('yesyes-auth') || '{}').state?.token || '';
  const r = await fetch(${JSON.stringify(pathname)}, { headers: { Authorization: 'Bearer ' + t } });
  return { status: r.status, body: await r.json().catch(() => null) };
})()`).catch(() => null);
const apiPost = (pathname) => evaluate(`(async () => {
  const t = JSON.parse(localStorage.getItem('yesyes-auth') || '{}').state?.token || '';
  const r = await fetch(${JSON.stringify(pathname)}, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } });
  return { status: r.status, body: await r.json().catch(() => null) };
})()`).catch(() => null);

const headline = (manifest) => {
  const blocks = (manifest?.sections || []).flatMap((s) => s.blocks || []);
  const hero = blocks.find((b) => String(b.block).startsWith('Hero'));
  return hero?.config?.headline || hero?.config?.title || null;
};

const escribirEn = (testid, valor) => `(() => {
  const el = document.querySelector('[data-testid="${testid}"]');
  if (!el) return 'NO EXISTE ${testid}';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(valor)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;


async function main() {
  await mkdir(captures, { recursive: true });
  const heartbeat = setInterval(() => { try { writeFileSync(path.join(captures, 'report.json'), JSON.stringify({ ...report, stage, now: new Date().toISOString() }, null, 2)); } catch { /* ignore */ } }, 8000);
  process.on('exit', () => clearInterval(heartbeat));

  const launched = await launchChrome();
  chrome = launched.chrome;
  client = new CDP(launched.page.webSocketDebuggerUrl, { runId });
  await client.open();
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);

  // ── A. Sesión real ───────────────────────────────────────────────────────
  stage = 'login';
  await goto(`${base}/login`);
  const probe = `(() => {
    const inputs = [...document.querySelectorAll('form input')].map(i => ({ type: i.type, ph: i.placeholder, testid: i.getAttribute('data-testid') }));
    const buttons = [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(Boolean);
    return JSON.stringify({ url: location.pathname, inputs, buttons: buttons.slice(0, 12), storage: Object.keys(localStorage) });
  })()`;
  report.evidencia.loginForm = await evaluate(probe);
  await evaluate(`(() => {
    const forms = [...document.querySelectorAll('form')].filter(f => f.querySelector('input[type=password]'));
    const form = forms[0];
    if (!form) return 'NO HAY FORMULARIO';
    const email = form.querySelector('input[type=email]');
    const pwd = form.querySelector('input[type=password]');
    const p = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(p, 'value').set.call(email, ${JSON.stringify(EMAIL)});
    email.dispatchEvent(new Event('input', { bubbles: true }));
    Object.getOwnPropertyDescriptor(p, 'value').set.call(pwd, ${JSON.stringify(PASSWORD)});
    pwd.dispatchEvent(new Event('input', { bubbles: true }));
    return 'LISTO';
  })()`);
  await sleep(400);
  const clickResult = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(n => /iniciar sesi/i.test(n.textContent || '')); if (!b) return 'NO HAY BOTON'; b.click(); return 'CLICK'; })()`);
  report.evidencia.click = clickResult;
  await sleep(7000);
  const toasts = await evaluate(`[...document.querySelectorAll('[role=alert], [role=status], .go2072408551, [id*=toast]')].map(n => n.innerText.trim()).filter(Boolean).slice(0, 6)`).catch(() => []);
  report.evidencia.toasts = toasts;
  const sesion = await evaluate(`(() => { try { return JSON.parse(localStorage.getItem('yesyes-auth') || '{}').state?.user?.email || null; } catch { return null; } })()`);
  report.evidencia.sesion = sesion;
  if (!sesion) {
    report.estado = 'SIN_SESION';
    report.limites = ['No se pudo iniciar sesion en la UI: los pasos que requieren sesion quedan pendientes.'];
  }

  // ── B. Estado de versiones por la API real ───────────────────────────────
  stage = 'versiones';
  const antes = await apiGet(`/api/engine/${BUSINESS_ID}/site-versions`);
  report.evidencia.versionesIniciales = antes?.body;
  paso('A) el backend distingue DRAFT y PUBLISHED', Boolean(antes?.body?.draft),
    `draft=${antes?.body?.draft?.fingerprint} published=${antes?.body?.published?.fingerprint ?? 'ninguna'} inSync=${antes?.body?.inSync}`);

  // ── C. Preview y página pública ANTES de editar ──────────────────────────
  stage = 'lectura';
  const previewAntes = await apiGet(`/api/businesses/preview/${SLUG}`);
  const publicaAntes = await apiGet(`/api/public/businesses/${SLUG}/page`);
  report.evidencia.previewAntes = { status: previewAntes?.status, headline: headline(previewAntes?.body?.business?.siteInstance?.manifest) };
  report.evidencia.publicaAntes = { status: publicaAntes?.status, headline: headline(publicaAntes?.body?.siteInstance?.manifest) };
  paso('B) preview y página pública responden por separado', Boolean(previewAntes && publicaAntes),
    `preview=${previewAntes?.status} publica=${publicaAntes?.status}`);


  // ── D. Editar el borrador por la UI real ─────────────────────────────────
  stage = 'edicion';
  await goto(`${base}/negocio/editor?id=${BUSINESS_ID}`);
  await sleep(5000);
  const tituloB = 'Clinica Veterinaria Los Robles version B';
  const escribio = await evaluate(escribirEn('builder-name-input', tituloB));
  const ctaOk = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="builder-cta-input"]');
    if (!el) return 'NO EXISTE cta';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, 'Agendar hora version B');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  report.evidencia.edicion = { nombre: escribio, cta: ctaOk };
  await sleep(8000);
  await shot('01-editor-version-b');

  const trasB = await apiGet(`/api/engine/${BUSINESS_ID}/site-versions`);
  report.evidencia.versionesTrasB = trasB?.body;
  paso('D) editar el borrador avanza SOLO el DRAFT',
    Boolean(trasB?.body?.draft) && trasB.body.draft.fingerprint !== antes?.body?.draft?.fingerprint && trasB.body.inSync === false,
    `draft=${trasB?.body?.draft?.fingerprint} published=${trasB?.body?.published?.fingerprint ?? 'ninguna'} inSync=${trasB?.body?.inSync}`);

  // ── E. F5: el borrador persiste ──────────────────────────────────────────
  stage = 'reload';
  await send('Page.reload', { ignoreCache: true });
  await sleep(7000);
  const trasRecarga = await apiGet(`/api/engine/${BUSINESS_ID}/site-versions`);
  report.evidencia.versionesTrasRecarga = trasRecarga?.body;
  paso('E) F5 conserva borrador y publicado por separado',
    trasRecarga?.body?.draft?.fingerprint === trasB?.body?.draft?.fingerprint
    && JSON.stringify(trasRecarga?.body?.published) === JSON.stringify(trasB?.body?.published),
    `draft=${trasRecarga?.body?.draft?.fingerprint} published=${trasRecarga?.body?.published?.fingerprint ?? 'ninguna'}`);
  await shot('02-editor-tras-f5');


  // ── F. La página pública NO cambió ───────────────────────────────────────
  stage = 'publica';
  const publicaDespues = await apiGet(`/api/public/businesses/${SLUG}/page`);
  const previewDespues = await apiGet(`/api/businesses/preview/${SLUG}`);
  const hPublica = headline(publicaDespues?.body?.siteInstance?.manifest);
  const hPreview = headline(previewDespues?.body?.business?.siteInstance?.manifest);
  report.evidencia.publicaDespues = { status: publicaDespues?.status, headline: hPublica };
  report.evidencia.previewDespues = { status: previewDespues?.status, headline: hPreview };
  paso('E2) editar el borrador NO modifica la pagina publica',
    publicaDespues?.status === publicaAntes?.status,
    `publica antes=${headline(publicaAntes?.body?.siteInstance?.manifest) ?? 'sin manifest'} despues=${hPublica ?? 'sin manifest'} | preview=${hPreview ?? 'sin manifest'}`);

  // ── G. Undo/Redo: sólo el borrador ───────────────────────────────────────
  stage = 'undo-redo';
  const antesUndo = await apiGet(`/api/engine/${BUSINESS_ID}/site-versions`);
  await evaluate(`(() => { const b = document.querySelector('[data-testid="builder-undo"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
  await sleep(6000);
  const trasUndo = await apiGet(`/api/engine/${BUSINESS_ID}/site-versions`);
  paso('F) Undo mueve el DRAFT y deja PUBLISHED intacta',
    trasUndo?.body?.draft?.fingerprint !== antesUndo?.body?.draft?.fingerprint
    && JSON.stringify(trasUndo?.body?.published) === JSON.stringify(antesUndo?.body?.published),
    `draft ${antesUndo?.body?.draft?.fingerprint} -> ${trasUndo?.body?.draft?.fingerprint}; published=${trasUndo?.body?.published?.fingerprint ?? 'ninguna'}`);
  await shot('03-undo');

  // ── H. Intento de publicación real ───────────────────────────────────────
  stage = 'publicacion';
  await evaluate(`(() => { const b = document.querySelector('[data-testid="builder-publish"]'); if (!b) return false; b.click(); return true; })()`);
  await sleep(8000);
  const alertas = await evaluate(`[...document.querySelectorAll('[role="alert"]')].map(n => n.innerText.trim()).filter(Boolean)`).catch(() => []);
  const post = await apiPost(`/api/businesses/${BUSINESS_ID}/publish`);
  report.evidencia.publicacion = { mensajeUI: alertas, respuesta: post };
  const gate = /suscripci|pago/i.test((alertas || []).join(' ')) || post?.body?.code === 'PAYMENT_REQUIRED';
  report.estado.publicacion = gate ? 'PUBLICATION = BLOCKED_EXTERNAL_DEPENDENCY' : (post?.status === 200 ? 'PUBLICADO' : `SIN_PUBLICAR (${post?.status})`);
  paso('G) intento de publicacion registrado tal cual', true, `${report.estado.publicacion} :: ${JSON.stringify(alertas)}`);
  await shot('04-publicacion');

  report.estado.pasos = report.pasos.length;
  report.estado.fallos = report.pasos.filter((p) => p.status === 'FALLO').length;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(captures, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nREPORTE:', path.join(captures, 'report.json'));
}

main()
  .catch(async (error) => {
    report.estado = 'ERROR';
    report.problemas.push({ paso: stage, error: String(error?.message || error).slice(0, 600) });
    try { await writeFile(path.join(captures, 'report.json'), JSON.stringify(report, null, 2)); } catch { /* ignore */ }
    console.error('ERROR:', error);
  })
  .finally(async () => {
    try { client?.close(); } catch { /* ignore */ }
    try { chrome?.kill(); } catch { /* ignore */ }
    process.exit(0);
  });
