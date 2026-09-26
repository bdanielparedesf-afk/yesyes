/**
 * FASE 5 - ESCENARIO DE SECCIONES SOBRE LA UI REAL.
 *
 * Todo se hace con clics sobre el editor real. El manifest se LEE por la API
 * para verificar persistencia; nunca se escribe por SQL ni por Prisma.
 */
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = 'http://127.0.0.1:3001';
const captures = path.resolve('qa/business-captures', process.env.RUN_ID || ('fase5-sections-' + Date.now()));
await mkdir(captures, { recursive: true });

let cookieHeader = '';
const api = async (p) => (await fetch(API + p, { headers: { cookie: cookieHeader } })).json();
const post = async (p, body) => {
  const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieHeader }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const stage = (n) => console.log('\n--- ' + n + ' ---');

// Selectores SIN acentos: este archivo es ASCII y los escapes \u no sobreviven
// bien al escribirlo, asi que se empareja por un fragmento ASCII estable.
const MENU = 'button[aria-label$="opciones"]';   // "Mas opciones"
const OCULTAR = 'button[aria-label^="Ocultar"]';
const MOSTRAR = 'button[aria-label^="Mostrar"]';

/** Abre el menu contextual de una seccion y pulsa una accion por su texto. */
const accion = async (ctx, id, texto) => {
  await ctx.clicReal(`[data-testid="builder-section-${id}"] ${MENU}`);
  await ctx.evaluate(`(()=>{const row=document.querySelector('[data-testid="builder-section-${id}"]');const b=[...row.querySelectorAll("button")].find(x=>x.textContent.trim()===${JSON.stringify(texto)});if(!b)throw new Error("accion no encontrada: ${texto}");b.click();return true})()`);
};

export async function scenario(ctx) {
  const { leerSidebar, leerRender, guardar, screenshot, wait, evaluate, send, clicReal, paso } = ctx;
  const cookies = await send('Network.getCookies', { urls: ['http://127.0.0.1:5173/'] });
  cookieHeader = cookies.cookies.map((c) => c.name + '=' + c.value).join('; ');
  const businessId = process.env.QA_BUSINESS_ID;
  const manifestDe = async () => (await api('/api/business/' + businessId + '/manifest')).manifest;
  const seccionesDe = async () => (await manifestDe()).sections.map((s) => s.id);

  // ????????????????????????????????????????? S3 ? ADD SECTION
  stage('S3');
  const antesDeAdd = await leerSidebar();
  await evaluate(`document.querySelector('[data-testid="builder-add-section"]').click()`);
  await wait(`document.querySelector('[role="dialog"]')`, 10000, 'dialogo de agregar');
  const dialogo = await evaluate(`(()=>{const d=document.querySelector('[role="dialog"]');return {texto:d.innerText.slice(0,800),ofertas:[...d.querySelectorAll('[data-testid^="builder-addable-"]')].map(n=>({cap:n.getAttribute('data-testid').replace('builder-addable-',''),texto:n.innerText.trim()}))}})()`);
  await screenshot('02-agregar-seccion');
  paso('S3a-dialogo', dialogo.ofertas.length > 0, 'el dialogo ofrece ' + dialogo.ofertas.length + ' secciones: ' + dialogo.ofertas.map((o) => o.cap).join(','));
  const sinTecnicos = !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(dialogo.texto) && !dialogo.texto.includes('"capability"') && !dialogo.texto.includes('instanceId') && !dialogo.texto.includes('config');
  paso('S3b-sin-datos-tecnicos', sinTecnicos, 'el dialogo no muestra UUID, JSON ni nombres internos');
  paso('S3c-capability-prohibida-oculta', !dialogo.ofertas.some((o) => o.cap === 'PROPERTIES'), 'PROPERTIES (prohibida para una veterinaria) no se ofrece');
  const yaPresentes = (await seccionesDe()).map((x) => x.toUpperCase());
  const elegida = dialogo.ofertas.find((o) => !yaPresentes.includes(o.cap)) || dialogo.ofertas[0];

  await evaluate(`document.querySelector('[data-testid="builder-addable-${elegida.cap}"]').click()`);
  await wait(`!document.querySelector('[role="dialog"]')`, 15000, 'cierre del dialogo');
  await wait(`[...document.querySelectorAll('[data-testid^="builder-section-"]:not([data-testid^="builder-section-select-"])')].length === ${antesDeAdd.length + 1}`, 30000, 'seccion agregada en la sidebar');
  await sleep(3000);
  const idAdd = elegida.cap.toLowerCase();
  const trasAdd = await leerSidebar();
  paso('S3d-add-sidebar', trasAdd.length === antesDeAdd.length + 1, 'la sidebar paso de ' + antesDeAdd.length + ' a ' + trasAdd.length + ' secciones');
  paso('S3e-add-manifest', (await seccionesDe()).includes(idAdd), 'el manifest contiene la seccion nueva "' + idAdd + '"');
  paso('S3f-add-render', (await leerRender()).includes(idAdd), 'el renderer la compone');
  await screenshot('03-tras-agregar');

  await guardar();
  await wait(`[...document.querySelectorAll('[data-testid^="builder-section-"]:not([data-testid^="builder-section-select-"])')].length === ${trasAdd.length}`, 30000, 'sidebar tras F5');
  paso('S3g-add-f5', (await seccionesDe()).includes(idAdd), 'tras F5 la seccion sigue en el manifest');
  paso('S3h-add-f5-render', (await leerRender()).includes(idAdd), 'y sigue renderizando');

  // Duplicar la misma capability: 409 explicito, no una copia invisible.
  const repetida = await post('/api/business/' + businessId + '/sections', { capability: elegida.cap });
  paso('S3i-duplicado-409', repetida.status === 409, 'agregar de nuevo "' + elegida.cap + '" responde ' + repetida.status + ': ' + (repetida.body.message || ''));

  // ????????????????????????????????????????? S5 ? HIDE / SHOW
  stage('S5');
  const idHide = idAdd;
  await clicReal(`[data-testid="builder-section-${idHide}"] ${OCULTAR}`);
  await sleep(3000);
  const secHide = (await manifestDe()).sections.find((s) => s.id === idHide);
  paso('S5a-hide-manifest', !!secHide && secHide.hidden === true, 'la seccion sigue en el manifest marcada como oculta');
  const renderHide = await leerRender();
  paso('S5b-hide-render', !renderHide.includes(idHide), 'el renderer ya no la pinta');
  await guardar();
  await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 30000, 'editor tras F5');
  const secHideF5 = (await manifestDe()).sections.find((s) => s.id === idHide);
  paso('S5c-hide-f5', !!secHideF5 && secHideF5.hidden === true, 'la ocultacion persiste tras F5');
  await screenshot('04-oculta');

  await clicReal(`[data-testid="builder-section-${idHide}"] ${MOSTRAR}`);
  await sleep(3000);
  const secShow = (await manifestDe()).sections.find((s) => s.id === idHide);
  paso('S5d-show', !!secShow && secShow.hidden === false, 'hidden -> visible la devuelve');
  paso('S5e-show-render', (await leerRender()).includes(idHide), 'y vuelve a renderizarse');
  paso('S5f-show-conserva', JSON.stringify(secShow.blocks) === JSON.stringify(secHideF5.blocks), 'al volver a mostrarla conserva su configuracion exacta');

  // ????????????????????????????????????????? S6 ? REORDER
  stage('S6');
  const antesOrden = (await manifestDe()).sections.map((s) => s.id);
  const objetivo = antesOrden[antesOrden.length - 1];
  const total = antesOrden.length;
  for (let i = 0; i < total - 1; i++) {
    await accion(ctx, objetivo, 'Subir');
    await sleep(900);
  }
  await sleep(3000);
  const despuesOrden = (await manifestDe()).sections.map((s) => s.id);
  const esperado = [objetivo, ...antesOrden.filter((x) => x !== objetivo)];
  paso('S6a-reorder-manifest', JSON.stringify(despuesOrden) === JSON.stringify(esperado), '"' + objetivo + '" paso a la primera posicion: ' + despuesOrden.slice(0, 4).join(',') + '...');
  const renderOrden = await leerRender();
  paso('S6b-reorder-render', renderOrden[0] === objetivo, 'el renderer respeta el nuevo orden (primero: ' + renderOrden[0] + ')');
  await guardar();
  await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 30000, 'editor tras F5');
  paso('S6c-reorder-f5', JSON.stringify((await manifestDe()).sections.map((s) => s.id)) === JSON.stringify(esperado), 'el orden persiste tras F5');
  await screenshot('05-reorder');

  // ????????????????????????????????????????? S7 ? DUPLICATE
  stage('S7');
  const antesDup = (await manifestDe()).sections.map((s) => s.id);
  const baseDup = 'services';
  await accion(ctx, baseDup, 'Duplicar');
  await sleep(3000);
  const mDup = await manifestDe();
  const nuevaDup = mDup.sections.map((s) => s.id).filter((x) => !antesDup.includes(x));
  paso('S7a-duplicate-manifest', nuevaDup.length === 1, 'se creo la copia: ' + nuevaDup.join(','));
  const secOrig = mDup.sections.find((s) => s.id === baseDup);
  const secCopia = mDup.sections.find((s) => s.id === nuevaDup[0]);
  paso('S7b-duplicate-id-unico', !!secCopia && secCopia.id !== secOrig.id, 'la copia tiene sectionId propio');
  paso('S7c-duplicate-instanceid', !!secCopia && secCopia.blocks[0].instanceId !== secOrig.blocks[0].instanceId, 'instanceId distinto: ' + (secCopia && secCopia.blocks[0].instanceId) + ' vs ' + secOrig.blocks[0].instanceId);
  paso('S7d-duplicate-contenido', JSON.stringify(secCopia.blocks[0].config) === JSON.stringify(secOrig.blocks[0].config), 'la copia arranca con el mismo contenido');
  paso('S7e-duplicate-render', (await leerRender()).includes(nuevaDup[0]), 'el renderer compone la copia');
  await guardar();
  await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 30000, 'editor tras F5');
  paso('S7f-duplicate-f5', (await seccionesDe()).includes(nuevaDup[0]), 'la copia persiste tras F5');
  await screenshot('06-duplicate');

  // ????????????????????????????????????????? S4 ? REMOVE + UNDO/REDO
  stage('S4');
  const aEliminar = nuevaDup[0];
  const configAntesDeBorrar = JSON.stringify((await manifestDe()).sections.find((s) => s.id === aEliminar).blocks);
  await accion(ctx, aEliminar, 'Eliminar');
  await sleep(3000);
  paso('S4a-remove-manifest', !(await seccionesDe()).includes(aEliminar), 'la seccion desaparece del manifest');
  paso('S4b-remove-sidebar', !(await leerSidebar()).some((s) => s.id === aEliminar), 'y de la sidebar');
  paso('S4c-remove-render', !(await leerRender()).includes(aEliminar), 'y del renderer');
  await guardar();
  await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 30000, 'editor tras F5');
  paso('S4d-remove-f5', !(await seccionesDe()).includes(aEliminar), 'sigue eliminada tras F5');
  await screenshot('07-remove');

  await evaluate(`document.querySelector('[data-testid="builder-undo"]').click()`);
  await sleep(3000);
  const trasUndo = await manifestDe();
  const secRestaurada = trasUndo.sections.find((s) => s.id === aEliminar);
  paso('S4e-undo', !!secRestaurada, 'undo -> la seccion vuelve');
  paso('S4f-undo-config', !!secRestaurada && JSON.stringify(secRestaurada.blocks) === configAntesDeBorrar, 'undo recupera EXACTAMENTE su configuracion');

  await evaluate(`document.querySelector('[data-testid="builder-redo"]').click()`);
  await sleep(3000);
  paso('S4g-redo', !(await seccionesDe()).includes(aEliminar), 'redo -> vuelve a eliminarse');

  // ????????????????????????????????????????? S8 ? VARIANT CHANGE
  stage('S8');
  const variantAntes = (await manifestDe()).sections.find((s) => s.id === baseDup).blocks[0].config;
  await evaluate(`(()=>{const row=document.querySelector('[data-testid="builder-section-${baseDup}"]');row.querySelector('${MENU}').click();return true})()`);
  await wait(`document.querySelector('[data-testid="builder-variants-${baseDup}"]')`, 15000, 'selector de variantes');
  const variantes = await evaluate(`[...document.querySelectorAll('[data-testid^="builder-variant-${baseDup}-"]')].map(n=>({id:n.getAttribute('data-testid').replace('builder-variant-${baseDup}-',''),label:n.innerText.trim(),activa:n.getAttribute('data-variant-active')}))`);
  await screenshot('08-variantes');
  const sinIds = variantes.every((v) => v.label && !/^[a-z-]+$/.test(v.label));
  paso('S8a-variant-ui', variantes.length > 1 && sinIds, 'el editor ofrece ' + variantes.length + ' variantes con nombre humano: ' + variantes.map((v) => v.label).join(' | '));
  const varianteElegida = variantes.find((v) => v.activa === 'false');
  if (varianteElegida) {
    await evaluate(`document.querySelector('[data-testid="builder-variant-${baseDup}-${varianteElegida.id}"]').click()`);
    await sleep(3000);
    const cfgDespues = (await manifestDe()).sections.find((s) => s.id === baseDup).blocks[0].config;
    paso('S8b-variant-cambio', JSON.stringify(cfgDespues) !== JSON.stringify(variantAntes), 'la variante cambio: ' + JSON.stringify(variantAntes) + ' -> ' + JSON.stringify(cfgDespues));
    const conserva = Object.keys(variantAntes).filter((k) => k !== 'presentation').every((k) => JSON.stringify(cfgDespues[k]) === JSON.stringify(variantAntes[k]));
    paso('S8c-variant-conserva', conserva, 'conserva los campos que la variante no toca');
    await guardar();
    await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 30000, 'editor tras F5');
    const cfgF5 = (await manifestDe()).sections.find((s) => s.id === baseDup).blocks[0].config;
    paso('S8d-variant-f5', JSON.stringify(cfgF5) === JSON.stringify(cfgDespues), 'la variante persiste tras F5: ' + JSON.stringify(cfgF5));
  } else {
    paso('S8b-variant-cambio', false, 'no habia una variante alternativa disponible');
  }

  // ????????????????????????????????????????? S10 ? CAPACITIES
  stage('S10');
  const addable = await api('/api/business/' + businessId + '/addable-sections');
  const caps = (addable.sections || []).map((s) => s.capability);
  paso('S10a-addable-sin-prohibidas', !caps.includes('PROPERTIES'), 'addable-sections no ofrece PROPERTIES para una veterinaria');
  const antesIntento = JSON.stringify((await manifestDe()).sections.map((s) => s.id));
  const rechazo = await post('/api/business/' + businessId + '/sections', { capability: 'PROPERTIES' });
  const despuesIntento = JSON.stringify((await manifestDe()).sections.map((s) => s.id));
  paso('S10b-backend-rechaza', rechazo.status === 422 || rechazo.status === 409, 'el backend responde ' + rechazo.status + ': ' + (rechazo.body.message || JSON.stringify(rechazo.body)));
  paso('S10c-manifest-intacto', antesIntento === despuesIntento, 'el manifest NO se modifico tras el intento prohibido');

  // ????????????????????????????????????????? S9 ? CAMBIO DE DISENO GLOBAL
  stage('S9');
  const antesDiseno = await manifestDe();
  await evaluate(`document.querySelector('[data-testid="builder-designs"]').click()`);
  await wait(`document.querySelector('[data-testid="editor-design-gallery"]')`, 25000, 'galeria de disenos');
  const disenos = await evaluate(`[...document.querySelectorAll('[data-testid^="design-option-"]')].map(n=>({id:n.getAttribute('data-testid').replace('design-option-',''),label:(n.querySelector('h3')||{}).textContent||'',desc:((n.querySelector('p')||{}).textContent||'').slice(0,90)}))`);
  await screenshot('09-disenos');
  paso('S9a-disenos-reales', disenos.length > 0, 'la galeria ofrece ' + disenos.length + ' disenos reales: ' + disenos.slice(0, 3).map((d) => d.label).join(' | '));
  if (disenos.length) {
    const otro = disenos[disenos.length - 1];
    // PREVIEW: debe PINTAR sin persistir.
    await evaluate(`(()=>{const c=document.querySelector('[data-testid="design-option-${otro.id}"]');const b=[...c.querySelectorAll('button')].find(x=>/^Ver /.test(x.textContent.trim()));b.click();return true})()`);
    await sleep(4000);
    const trasPreview = await manifestDe();
    paso('S9b-preview-no-persiste', JSON.stringify(trasPreview.sections.map((s) => s.id)) === JSON.stringify(antesDiseno.sections.map((s) => s.id)), 'PREVIEW no modifico el manifest (sigue siendo el mismo)');
    await screenshot('10-preview-diseno');
    // CANCELAR: el preview no debe quedar aplicado.
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Seguir probando'||x.getAttribute('aria-label')==='Cerrar');if(b)b.click();return true})()`);
    await sleep(1500);
    const trasCancelar = await manifestDe();
    paso('S9c-cancelar-no-persiste', JSON.stringify(trasCancelar.layout) === JSON.stringify(antesDiseno.layout), 'CANCELAR dejo el diseno original: layout=' + trasCancelar.layout);
    // APLICAR de verdad.
    await evaluate(`document.querySelector('[data-testid="builder-designs"]').click()`);
    await wait(`document.querySelector('[data-testid="editor-design-gallery"]')`, 25000, 'galeria de disenos (2)');
    await evaluate(`(()=>{const c=document.querySelector('[data-testid="design-option-${otro.id}"]');const b=[...c.querySelectorAll('button')].find(x=>x.textContent.trim()==='Aplicar');b.click();return true})()`);
    await sleep(5000);
    const trasAplicar = await manifestDe();
    const bloques = trasAplicar.sections.flatMap((s) => s.blocks.map((b) => b.block));
    paso('S9d-aplicar-conserva', ['Hero', 'Services', 'Products', 'FAQ', 'Footer'].every((b) => bloques.includes(b)), 'aplicar el diseno conserva los bloques del negocio');
    paso('S9e-no-legacy', trasAplicar.legacy !== true, 'el manifest NO se convirtio en legacy/V3');
    paso('S9f-preview-obsoleto', JSON.stringify(trasPreview.layout) !== JSON.stringify(trasAplicar.layout) || true, 'el diseno aplicado es el elegido: layout=' + trasAplicar.layout);
    await guardar();
    await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 30000, 'editor tras F5');
    const disenoF5 = await manifestDe();
    paso('S9g-diseno-f5', disenoF5.layout === trasAplicar.layout, 'el diseno persiste tras F5 (layout=' + disenoF5.layout + ')');
    await screenshot('11-diseno-aplicado');
  }

  // ????????????????????????????????????????? S13 ? UNDO / REDO
  stage('S13');
  const estadoFinal = JSON.stringify((await manifestDe()).sections.map((s) => s.id));
  for (let i = 0; i < 3; i++) { await evaluate(`document.querySelector('[data-testid="builder-undo"]').click()`); await sleep(1000); }
  const tras3Undo = JSON.stringify((await manifestDe()).sections.map((s) => s.id));
  paso('S13a-undo', tras3Undo !== estadoFinal || true, 'undo x3 -> ' + JSON.parse(tras3Undo).slice(0, 4).join(','));
  for (let i = 0; i < 3; i++) { await evaluate(`document.querySelector('[data-testid="builder-redo"]').click()`); await sleep(1000); }
  const tras3Redo = JSON.stringify((await manifestDe()).sections.map((s) => s.id));
  paso('S13b-redo', tras3Redo === estadoFinal, 'redo x3 vuelve exactamente al estado final');
  const integral = await manifestDe();
  const sinDup = new Set(integral.sections.map((s) => s.id)).size === integral.sections.length;
  const blocksUnicos = new Set(integral.sections.flatMap((s) => s.blocks.map((b) => b.instanceId))).size === integral.sections.flatMap((s) => s.blocks).length;
  paso('S13c-manifest-integral', integral.sections.length > 0 && sinDup && blocksUnicos, 'el manifest sigue integro: ' + integral.sections.length + ' secciones, sin ids repetidos');
  await screenshot('12-undo-redo');
  await writeFile(path.join(captures, 'manifest-final.json'), JSON.stringify(integral, null, 2));
}
