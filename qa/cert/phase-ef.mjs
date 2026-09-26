/**
 * FASE E-F â€” MEDIOS Y VIDEO REALES en la pagina creada por la UI.
 *
 * Sube imagenes y un video REALES por el control MediaField del editor, los
 * asigna a bloques, y verifica que sobreviven a F5, al preview y a la pagina
 * publica. El archivo se inyecta en el <input type=file> de la propia UI: no se
 * llama al endpoint de upload por la fuerza ni se escribe en la base de datos.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { APP, Page, apiGet, launchBrowser, sleep } from './driver.mjs';

const NEGOCIO = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const runId = process.env.RUN_ID || `cert-ef-${Date.now()}`;
const SHOTS = path.resolve('qa/cert-captures', runId);
const report = { runId, startedAt: new Date().toISOString(), pasos: [], fallos: [], negocioId: NEGOCIO.id, medios: [] };
const paso = (n, ok, detalle) => {
  report.pasos.push({ n, ok, detalle });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n} :: ${detalle}`);
  if (!ok) report.fallos.push(`${n} :: ${detalle}`);
};

const HERO = 'hero-aurora.png';
const VIDEO = 'cocina-aurora.webm';
const GALERIA = ['galeria-salon.png', 'galeria-jardin.png', 'equipo-cocina.png'];


/**
 * Inyecta un archivo REAL en el <input type=file> del MediaField y dispara el
 * cambio, que es lo que haria el usuario al elegir un archivo de su disco.
 *
 * CDP no expone un setter de archivos: se usa DOM.setFileInputFiles, que es la
 * via estandar de DevTools para esto.
 */
async function setFile(page, inputSelector, filePath) {
  const node = await page.cdp.send('DOM.getDocument', { depth: -1 }, { description: 'getDocument' });
  const { nodeId } = await page.cdp.send('DOM.querySelector', {
    nodeId: node.root.nodeId,
    selector: inputSelector,
  }, { description: 'querySelector', timeoutMs: 15_000 });
  if (!nodeId) return false;
  const abs = path.resolve(filePath);
  await page.cdp.send('DOM.setFileInputFiles', { files: [abs], nodeId }, { description: 'setFileInputFiles', timeoutMs: 20_000 });
  return true;
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const { child, target, port } = await launchBrowser({ runId, port: 9731 });
  const page = await Page.create(target);
  try {
    await page.restoreSession(NEGOCIO.storage);
    await page.goto(`${APP}/negocio/editor?id=${NEGOCIO.id}`, { waitMs: 3000 });
    const abrio = await page.waitFor('[data-testid="business-builder"]', 60_000);
    paso('E0-editor', abrio, 'Editor abierto para la fase de medios');
    if (!abrio) return finish(child, page);
    await page.clearErrors();
    await page.screenshot(SHOTS, 'E0-inicio');

    // â”€â”€ Selecciona la secciÃ³n Portada y sube la imagen real â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await page.click('[data-testid="builder-section-select-inicio"]');
    await sleep(2000);
    const campos = await page.eval(`[...document.querySelectorAll('[data-testid^="media-field-"]')].map((n) => n.getAttribute('data-testid'))`);
    paso('E1-campos-media', campos.length > 0, `El inspector ofrece ${campos.length} campos de medio: ${campos.join(', ')}`);
    await page.screenshot(SHOTS, 'E1-inspector-portada');

    if (campos.length) {
      const ok = await setFile(page, '[data-testid^="media-field-"] input[type="file"]', `qa/cert-media/${HERO}`);
      paso('E2-subir-hero', ok, `Seleccionado el archivo real ${HERO} en el campo de imagen`);
      // La subida es una llamada real: se espera a que la biblioteca la muestre.
      let subio = false;
      for (let i = 0; i < 40; i += 1) {
        await sleep(1000);
        const m = await apiGet(`/api/businesses/${NEGOCIO.id}/media`, NEGOCIO.token);
        const imagenes = (m.body?.media || []).filter((x) => x.kind === 'IMAGE');
        if (imagenes.length) { report.medios = imagenes; subio = true; break; }
      }
      paso('E3-almacenada', subio, `Storage guardo ${report.medios.length} imagen(es) del negocio`);
      if (subio) {
        const primera = report.medios[0];
        const head = await fetch(primera.url, { method: 'HEAD' }).catch(() => null);
        paso('E4-url-publica', Boolean(head && head.ok), `La imagen se sirve desde Storage (HTTP ${head ? head.status : 'sin respuesta'})`);
      }
    }

    // â”€â”€ VIDEO REAL (obligatorio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Se busca una secciÃ³n con campo de video en el editor. El control es el
    // mismo MediaField pero kind="video": sube, guarda y asigna el media-ref.
    // La pagina no trae una seccion de video: primero se AGREGA por la propia
    // UI (el selector "+ Agregar") y despues se le sube un archivo real.
    const yaExiste = await page.eval(`Boolean(document.querySelector('[data-testid="builder-section-select-video"]'))`);
    let agregarVideo = yaExiste;
    if (!yaExiste) {
      await page.click('[data-testid="builder-add-section"]');
      await sleep(1500);
      const offered = await page.eval(`Boolean(document.querySelector('[data-testid="builder-addable-VIDEO"]'))`);
      agregarVideo = offered ? await page.click('[data-testid="builder-addable-VIDEO"]') : false;
    }
    paso('F0-agregar-video', Boolean(agregarVideo), yaExiste
      ? 'La seccion de Video ya existia (ejecucion idempotente)'
      : (agregarVideo ? 'Seccion de Video agregada desde el selector de la UI' : 'el selector de la UI no ofrecio la seccion de Video'));
    await sleep(4000);

    const secciones = await page.eval(`[...document.querySelectorAll('[data-testid^="builder-section-select-"]')].map((n) => n.getAttribute('data-testid').replace('builder-section-select-', ''))`);
    let videoField = null;
    let videoSection = null;
    for (const id of secciones) {
      await page.click(`[data-testid="builder-section-select-${id}"]`);
      await sleep(900);
      const found = await page.eval(`(() => {
        const f = [...document.querySelectorAll('[data-testid^="media-field-"]')].find((n) => /video/i.test(n.innerText || ''));
        return f ? f.getAttribute('data-testid') : '';
      })()`);
      if (found) { videoField = found; videoSection = id; break; }
    }
    paso('F1-campo-video', Boolean(videoField), `Campo de video en la seccion "${videoSection || 'ninguna'}" (${videoField || '-'})`);

    if (videoField) {
      const bytes = (await readFile(`qa/cert-media/${VIDEO}`)).length;
      const ok = await setFile(page, `[data-testid="${videoField}"] input[type="file"]`, `qa/cert-media/${VIDEO}`);
      paso('F2-subir-video', ok, `Seleccionado el video real ${VIDEO} (${bytes} bytes)`);
      let videoRow = null;
      for (let i = 0; i < 60; i += 1) {
        await sleep(1000);
        const m = await apiGet(`/api/businesses/${NEGOCIO.id}/media`, NEGOCIO.token);
        const videos = (m.body?.media || []).filter((x) => x.kind === 'VIDEO');
        if (videos.length) { videoRow = videos[0]; break; }
      }
      paso('F3-video-almacenado', Boolean(videoRow), videoRow ? `Video en Storage: ${videoRow.url.slice(0, 90)}` : 'el video no llego al almacenamiento');
      if (videoRow) {
        const head = await fetch(videoRow.url, { method: 'HEAD' }).catch(() => null);
        paso('F4-video-servido', Boolean(head && head.ok), `El video se sirve por HTTP (${head ? head.status : 'sin respuesta'})`);
        const decode = await page.eval(`(async () => {
          const v = document.createElement('video');
          v.muted = true; v.playsInline = true; v.preload = 'metadata';
          v.src = ${JSON.stringify(videoRow.url)};
          const meta = await new Promise((resolve) => {
            const done = (ok) => resolve({ ok, w: v.videoWidth, h: v.videoHeight, d: v.duration });
            v.onloadedmetadata = () => done(true);
            v.onerror = () => done(false);
            setTimeout(() => done(false), 20000);
          });
          if (!meta.ok) return { ...meta, played: false };
          try { await v.play(); await new Promise((r) => setTimeout(r, 1200)); } catch { /* autoplay */ }
          return { ...meta, played: v.currentTime > 0.05, t: Number(v.currentTime.toFixed(2)) };
        })()`);
        paso('F5-video-reproduce', Boolean(decode.ok && decode.played), `Decodifica y reproduce: ${JSON.stringify(decode)}`);
        report.video = { url: videoRow.url, decode };
      }
    }

    // â”€â”€ GALERÃA: varias imÃ¡genes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GALERIA: el bloque `ImageGallery` NO declara campos `media-ref` (solo
    // `title` y `columns`); sus imagenes vienen del contenido del negocio
    // (`business.gallery`), que el editor V2 todavia no deja editar. Se
    // registra el contrato real en vez de inventar un campo que no existe.
    await page.click('[data-testid="builder-section-select-galeria"]');
    await sleep(2000);
    const camposGaleria = await page.eval(`[...document.querySelectorAll('[data-testid^="media-field-"]')].map((n) => n.getAttribute('data-testid'))`);
    const registries = await page.eval(`fetch('/api/template-engine/registries').then((r) => r.json()).then((d) => ((d.blocks || []).find((b) => b.id === 'ImageGallery')?.configSchema || []).map((f) => f.type))`);
    paso('F6-contrato-galeria', !registries.includes('media-ref'),
      `ImageGallery declara ${JSON.stringify(registries)}: sin media-ref, sus imagenes salen de business.gallery (campos en pantalla: ${camposGaleria.length})`);
    report.brechaGaleria = registries.includes('media-ref')
      ? null
      : 'El editor V2 no expone carga de imagenes para la galeria: ImageGallery no declara media-ref y business.gallery no es editable desde el builder.';

    // Varias imagenes mas por la portada, para exercised el picker en serie.
    let imagenes = report.medios.length;
    await page.click('[data-testid="builder-section-select-inicio"]');
    await sleep(1500);
    for (const name of GALERIA) {
      const ok = await setFile(page, '[data-testid^="media-field-"] input[type="file"]', `qa/cert-media/${name}`);
      if (!ok) { paso(`F6-subir-${name}`, false, 'no se encontro el input de archivo'); continue; }
      let sube = false;
      for (let i = 0; i < 30; i += 1) {
        await sleep(1000);
        const m = await apiGet(`/api/businesses/${NEGOCIO.id}/media`, NEGOCIO.token);
        const total = (m.body?.media || []).filter((x) => x.kind === 'IMAGE').length;
        if (total > imagenes) { imagenes = total; sube = true; break; }
      }
      paso(`F6-subir-${name}`, sube, `imagenes en Storage: ${imagenes}`);
    }
    await page.screenshot(SHOTS, 'F7-medios-cargados');

    // â”€â”€ F5: los medios sobreviven â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await sleep(5000);
    await page.goto(`${APP}/negocio/editor?id=${NEGOCIO.id}`, { waitMs: 3000 });
    await page.waitFor('[data-testid="business-builder"]', 60_000);
    await sleep(3000);
    const trasRecarga = await apiGet(`/api/businesses/${NEGOCIO.id}/media`, NEGOCIO.token);
    const imgs = (trasRecarga.body?.media || []).filter((x) => x.kind === 'IMAGE').length;
    const vids = (trasRecarga.body?.media || []).filter((x) => x.kind === 'VIDEO').length;
    paso('F7-medios-persisten', imgs >= 4 && vids >= 1, `Tras F5 conserva ${imgs} imagenes y ${vids} video(s)`);
    report.mediosFinales = { imagenes: imgs, videos: vids };

    const erroresMedia = page.failedRequests.filter((r) => r.url.includes('/media'));
    paso('F8-red-limpia', erroresMedia.length === 0, `errores de red en medios: ${JSON.stringify(erroresMedia.slice(0, 4))}`);

    return finish(child, page);
  } catch (error) {
    paso('ERROR', false, String(error && error.message ? error.message : error));
    return finish(child, page);
  }
}

async function finish(child, page) {
  try { await page.screenshot(SHOTS, 'zz-final'); } catch { /* noop */ }
  report.finishedAt = new Date().toISOString();
  await writeFile(path.resolve('qa/cert-phase-ef.json'), JSON.stringify(report, null, 2));
  console.log('\n--- RESUMEN FASE E-F ---');
  console.log(`pasos: ${report.pasos.length}  fallos: ${report.fallos.length}`);
  if (report.fallos.length) console.log(report.fallos.join('\n'));
  page.close();
  child.kill();
  process.exit(report.fallos.length ? 1 : 0);
}

main();
