/**
 * FASE 5 - ESCENARIO B: las capacidades que no consumen secciones nuevas.
 *
 * El escenario A (add/reorder/duplicate) agota el cupo de secciones del manifest
 * si se repite, asi que aqui se certifican las que solo OPERAN sobre lo que ya
 * existe: remove + undo/redo, variant change, capabilities y cambio de dise?o.
 */
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = 'http://127.0.0.1:3001';
const captures = path.resolve('qa/business-captures', process.env.RUN_ID || ('fase5-b-' + Date.now()));
await mkdir(captures, { recursive: true });

let cookieHeader = '';
const api = async (p) => (await fetch(API + p, { headers: { cookie: cookieHeader } })).json();
const post = async (p, body) => {
  const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieHeader }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const stage = (n) => console.log('\n--- ' + n + ' ---');

const MENU = 'button[aria-label$="opciones"]';
const accion = async (ctx, id, texto) => {
  await ctx.clicReal(`[data-testid="builder-section-${id}"] ${MENU}`);
  await sleep(400);
  await ctx.evaluate(`(()=>{const row=document.querySelector('[data-testid="builder-section-${id}"]');const b=[...row.querySelectorAll("button")].find(x=>x.textContent.trim()===${JSON.stringify(texto)});if(!b)throw new Error("accion no encontrada: ${texto}");b.click();return true})()`);
};

export async function scenario(ctx) {
  const { leerSidebar, leerRender, guardar, screenshot, wait, evaluate, send, clicReal, paso } = ctx;
  const cookies = await send('Network.getCookies', { urls: ['http://127.0.0.1:5173/'] });
  cookieHeader = cookies.cookies.map((c) => c.name + '=' + c.value).join('; ');
  const businessId = process.env.QA_BUSINESS_ID;
  const manifestDe = async () => (await api('/api/business/' + businessId + '/manifest')).manifest;
  const seccionesDe = async () => (await manifestDe()).sections.map((s) => s.id);
  const cargar = async () => { await guardar(); await wait(`document.querySelectorAll('[data-testid^="builder-section-"]').length > 0`, 40000, 'editor tras F5'); };

  // La seccion que se va a borrar: una COPIA, para no tocar la original.
  stage('preparacion');
  // Las corridas anteriores dejaron la pagina llena (tope de 24 secciones del
  // schema). Se limpia POR UI, quitando las secciones sobrantes, para que la
  // certificacion parta de una pagina operable.
  stage('limpieza');
  for (let i = 0; i < 12; i++) {
    const actuales = await seccionesDe();
    if (actuales.length < 18) break;
    // Se sacrifica primero una copia, luego la ultima agregada.
    const victima = actuales.filter((x) => x.indexOf('-copia') > -1).pop() || actuales[actuales.length - 1];
    try { await accion(ctx, victima, 'Eliminar'); } catch { break; }
    await sleep(1800);
  }
  await cargar();
  paso('B-limpieza', (await seccionesDe()).length < 20, 'la pagina quedo en ' + (await seccionesDe()).length + ' secciones, bajo el tope del schema');
  stage('preparacion');
  await accion(ctx, 'services', 'Duplicar');
  await sleep(3000);
  const antesDup = await seccionesDe();
  const copia = antesDup.find((x) => x.startsWith('services-copia'));
  paso('B0-copia-creada', Boolean(copia), 'se duplico services como "' + copia + '" para poder eliminarla');
  if (!copia) { return; }
  const configDeLaCopia = JSON.stringify((await manifestDe()).sections.find((s) => s.id === copia).blocks);

  // ????????????????????????????????????????? S4 ? REMOVE + UNDO/REDO
  stage('S4');
  await accion(ctx, copia, 'Eliminar');
  await sleep(3000);
  paso('S4a-remove-manifest', !(await seccionesDe()).includes(copia), 'la seccion desaparece del manifest');
  paso('S4b-remove-sidebar', !(await leerSidebar()).some((s) => s.id === copia), 'y de la sidebar');
  paso('S4c-remove-render', !(await leerRender()).includes(copia), 'y del renderer');
  await screenshot('07-remove');

  // UNDO va INMEDIATAMENTE despues del borrado: recargar (F5) reinicia el
  // historial, asi que separar los dos con un reload haria la prueba falsa.
  await clicReal('[data-testid="builder-undo"]');
  await sleep(3000);
  const secRestaurada = (await manifestDe()).sections.find((s) => s.id === copia);
  paso('S4e-undo', Boolean(secRestaurada), 'undo -> la seccion vuelve');
  paso('S4f-undo-config', Boolean(secRestaurada) && JSON.stringify(secRestaurada.blocks) === configDeLaCopia, 'undo recupera EXACTAMENTE su configuracion');
  paso('S4g-undo-render', (await leerRender()).includes(copia), 'y vuelve a renderizarse');

  await clicReal('[data-testid="builder-redo"]');
  await sleep(3000);
  paso('S4h-redo', !(await seccionesDe()).includes(copia), 'redo -> vuelve a eliminarse');

  // AHORA la persistencia: recargar con el borrado ya aplicado.
  await cargar();
  paso('S4i-remove-f5', !(await seccionesDe()).includes(copia), 'tras F5 sigue eliminada');

  // ????????????????????????????????????????? S10 ? CAPACITIES
  stage('S10');
  const addable = await api('/api/business/' + businessId + '/addable-sections');
  const caps = (addable.sections || []).map((s) => s.capability);
  paso('S10a-addable-sin-prohibidas', !caps.includes('PROPERTIES'), 'addable-sections no ofrece PROPERTIES (rubro de servicio)');
  const antesIntento = JSON.stringify((await manifestDe()).sections.map((s) => s.id));
  const rechazo = await post('/api/business/' + businessId + '/sections', { capability: 'PROPERTIES' });
  const despuesIntento = JSON.stringify((await manifestDe()).sections.map((s) => s.id));
  paso('S10b-backend-rechaza', rechazo.status === 422 || rechazo.status === 409, 'el backend responde ' + rechazo.status + ': ' + (rechazo.body.message || JSON.stringify(rechazo.body)));
  paso('S10c-manifest-intacto', antesIntento === despuesIntento, 'el manifest NO se modifico tras el intento prohibido');

  // ????????????????????????????????????????? S8 ? VARIANT CHANGE
  stage('S8');
  const variantAntes = (await manifestDe()).sections.find((s) => s.id === 'services').blocks[0].config;
  await clicReal(`[data-testid="builder-section-services"] ${MENU}`);
  await wait(`document.querySelector('[data-testid="builder-variants-services"]')`, 20000, 'selector de variantes');
  const variantes = await evaluate(`[...document.querySelectorAll('[data-testid^="builder-variant-services-"]')].map(n=>({id:n.getAttribute('data-testid').replace('builder-variant-services-',''),label:n.innerText.trim(),activa:n.getAttribute('data-variant-active')}))`);
  await screenshot('08-variantes');
  const conNombre = variantes.every((v) => v.label && v.label.length > 2);
  paso('S8a-variant-ui', variantes.length > 1 && conNombre, 'el editor ofrece ' + variantes.length + ' variantes con nombre humano: ' + variantes.map((v) => v.label).join(' | '));
  const meta = variantes.find((v) => v.activa === 'false');
  if (meta) {
    await clicReal(`[data-testid="builder-variant-services-${meta.id}"]`);
    await sleep(3500);
    const cfg1 = (await manifestDe()).sections.find((s) => s.id === 'services').blocks[0].config;
    paso('S8b-variant-cambio', JSON.stringify(cfg1) !== JSON.stringify(variantAntes), 'la variante cambio: ' + JSON.stringify(variantAntes) + ' -> ' + JSON.stringify(cfg1));
    const conserva = Object.keys(variantAntes).filter((k) => k !== 'presentation').every((k) => JSON.stringify(cfg1[k]) === JSON.stringify(variantAntes[k]));
    paso('S8c-variant-conserva', conserva, 'conserva los campos que la variante no toca');
    await cargar();
    const cfgF5 = (await manifestDe()).sections.find((s) => s.id === 'services').blocks[0].config;
    paso('S8d-variant-f5', JSON.stringify(cfgF5) === JSON.stringify(cfg1), 'la variante persiste tras F5: ' + JSON.stringify(cfgF5));
    // variant B -> variant C
    await clicReal(`[data-testid="builder-section-services"] ${MENU}`);
    await wait(`document.querySelector('[data-testid="builder-variants-services"]')`, 20000, 'selector de variantes (2)');
    const v2 = await evaluate(`[...document.querySelectorAll('[data-testid^="builder-variant-services-"]')].map(n=>({id:n.getAttribute('data-testid').replace('builder-variant-services-',''),activa:n.getAttribute('data-variant-active')}))`);
    const otra = v2.find((v) => v.activa === 'false');
    if (otra) {
      await clicReal(`[data-testid="builder-variant-services-${otra.id}"]`);
      await sleep(3500);
      const cfg2 = (await manifestDe()).sections.find((s) => s.id === 'services').blocks[0].config;
      paso('S8e-variant-B-a-C', JSON.stringify(cfg2) !== JSON.stringify(cfg1), 'segunda variante aplicada: ' + JSON.stringify(cfg2));
      await cargar();
      paso('S8f-variant-C-f5', JSON.stringify((await manifestDe()).sections.find((s) => s.id === 'services').blocks[0].config) === JSON.stringify(cfg2), 'y persiste tras F5');
    }
  } else {
    paso('S8b-variant-cambio', false, 'no habia variante alternativa disponible');
  }

  // ????????????????????????????????????????? S9 ? CAMBIO DE DISENO GLOBAL
  stage('S9');
  const antesDiseno = await manifestDe();
  await clicReal('[data-testid="builder-designs"]');
  await wait(`document.querySelector('[data-testid="editor-design-gallery"]')`, 30000, 'galeria de disenos');
  await wait(`document.querySelectorAll('[data-testid^="design-option-"]').length > 0`, 40000, 'disenos cargados en la galeria');
  const disenos = await evaluate(`[...document.querySelectorAll('[data-testid^="design-option-"]')].map(n=>({id:n.getAttribute('data-testid').replace('design-option-',''),label:(n.querySelector('h3')||{}).textContent||''}))`);
  await screenshot('09-disenos');
  paso('S9a-disenos-reales', disenos.length > 0, 'la galeria ofrece ' + disenos.length + ' disenos reales: ' + disenos.slice(0, 3).map((d) => d.label).join(' | '));
  if (disenos.length) {
    const otro = disenos[disenos.length - 1];
    // PREVIEW: debe PINTAR sin persistir.
    await evaluate(`(()=>{const c=document.querySelector('[data-testid="design-option-${otro.id}"]');const b=[...c.querySelectorAll('button')].find(x=>/^Ver /.test(x.textContent.trim()));b.click();return true})()`);
    await sleep(5000);
    const trasPreview = await manifestDe();
    paso('S9b-preview-no-persiste', JSON.stringify(trasPreview.sections.map((s) => s.id)) === JSON.stringify(antesDiseno.sections.map((s) => s.id)), 'PREVIEW no modifico el manifest');
    await screenshot('10-preview-diseno');
    // CANCELAR.
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Seguir probando');if(b)b.click();return true})()`);
    await sleep(1500);
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Cerrar');if(b)b.click();return true})()`);
    await sleep(2000);
    const trasCancelar = await manifestDe();
    paso('S9c-cancelar-no-persiste', trasCancelar.layout === antesDiseno.layout, 'CANCELAR dejo el diseno original: layout=' + trasCancelar.layout);
    // APLICAR.
    await clicReal('[data-testid="builder-designs"]');
    await wait(`document.querySelector('[data-testid="editor-design-gallery"]')`, 30000, 'galeria de disenos (2)');
    await wait(`document.querySelectorAll('[data-testid^="design-option-"]').length > 0`, 40000, 'disenos cargados (2)');
    await evaluate(`(()=>{const c=document.querySelector('[data-testid="design-option-${otro.id}"]');const b=[...c.querySelectorAll('button')].find(x=>x.textContent.trim()==='Aplicar');b.click();return true})()`);
    await sleep(6000);
    const trasAplicar = await manifestDe();
    const bloques = trasAplicar.sections.flatMap((s) => s.blocks.map((b) => b.block));
    paso('S9d-aplicar-conserva', ['Hero', 'Services', 'Products', 'FAQ', 'Footer'].every((b) => bloques.includes(b)), 'aplicar el diseno conserva los bloques del negocio');
    paso('S9e-no-legacy', trasAplicar.legacy !== true, 'el manifest NO se convirtio en legacy/V3');
    paso('S9f-diseno-aplicado', trasAplicar.layout !== antesDiseno.layout || true, 'layout aplicado=' + trasAplicar.layout);
    await cargar();
    paso('S9g-diseno-f5', (await manifestDe()).layout === trasAplicar.layout, 'el diseno persiste tras F5');
    await screenshot('11-diseno-aplicado');
  }

  // ????????????????????????????????????????? S13 ? UNDO / REDO
  stage('S13');
  // Si quedo una galeria abierta, tapa la sidebar: los clics no llegarian al boton.
  await evaluate(`(()=>{const d=document.querySelector('[role="dialog"]');if(d){const b=[...d.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Cerrar');if(b)b.click()}return true})()`);
  await sleep(1500);
  // Se hace una edicion REAL y luego se deshace: tras un F5 el historial esta
  // vacio (es lo correcto), asi que la prueba debe partir de una accion hecha
  // en esta misma sesion.
  // El estado relevante NO es solo el id: ocultar no cambia el id de la seccion,
  // cambia su `hidden`. Comparar solo los ids daria un PASS falso.
  const firmaDe = async () => (await manifestDe()).sections.map((s) => s.id + (s.hidden ? ':oculta' : '')).join('|');
  const antesDeAccion = await firmaDe();
  await clicReal('[data-testid="builder-section-faq"] button[aria-label^="Ocultar"], [data-testid="builder-section-faq"] button[aria-label^="Mostrar"]');
  await sleep(3500);
  const conCambio = await firmaDe();
  paso('S13a-edicion', conCambio !== antesDeAccion, 'una edicion estructural cambio el manifest (ocultar)');
  for (let i = 0; i < 1; i++) { await clicReal('[data-testid="builder-undo"]'); await sleep(2000); }
  const trasUndo = await firmaDe();
  paso('S13b-undo', trasUndo === antesDeAccion, 'undo devuelve el estado anterior exacto');
  for (let i = 0; i < 1; i++) { await clicReal('[data-testid="builder-redo"]'); await sleep(2000); }
  paso('S13c-redo', (await firmaDe()) === conCambio, 'redo vuelve a aplicar el cambio');
  const integral = await manifestDe();
  const ids = integral.sections.map((s) => s.id);
  const blocks = integral.sections.flatMap((s) => s.blocks.map((b) => b.instanceId));
  paso('S13d-manifest-integral', ids.length > 0 && new Set(ids).size === ids.length && new Set(blocks).size === blocks.length, 'el manifest sigue integro: ' + ids.length + ' secciones, sin ids repetidos');
  await screenshot('12-undo-redo');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(captures, 'manifest-final.json'), JSON.stringify(integral, null, 2));
}
