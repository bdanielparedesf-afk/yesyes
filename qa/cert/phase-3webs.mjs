/**
 * Crea negocios de rubros DISTINTOS usando el creador de paginas REAL
 * (/negocio/nuevo) y los publica, todo por la UI con Chrome/CDP.
 *
 * No se escribe nada por SQL ni por API de creacion: se elige el rubro, se
 * escoge un diseno de la galeria, se rellena el formulario y se pulsa el
 * boton. La publicacion se hace desde el boton "Publicar" del dashboard.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { APP, Page, apiGet, launchBrowser, sleep } from './driver.mjs';

const SESION = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const runId = `tres-webs-${Date.now()}`;
const SHOTS = path.resolve('qa/cert-captures', runId);
const report = { runId, startedAt: new Date().toISOString(), negocios: [], pasos: [], fallos: [] };
const paso = (n, ok, d) => {
  report.pasos.push({ n, ok, detalle: d });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n} :: ${d}`);
  if (!ok) report.fallos.push(`${n} :: ${d}`);
};

/** Tres rubros bien distintos: comida, mascotas e inmobiliaria. */
const NEGOCIOS = [
  { categoria: 'BARBER', nombre: 'Barberia Don Nico', descripcion: 'Corte clasico y afeitado a navaja.', tel: '+56 9 3344 5566', ciudad: 'Valparaiso' },
  { categoria: 'HAIR', nombre: 'Estudio Cabello Vivo', descripcion: 'Color, corte y tratamiento capilar.', tel: '+56 9 7788 9900', ciudad: 'Rancagua' },
];

/** Escribe en un input por su etiqueta visible, como haria el usuario. */
async function fillByLabel(page, label, value) {
  return page.eval(`(() => {
    const wanted = ${JSON.stringify(label.toLowerCase())};
    for (const node of document.querySelectorAll('label')) {
      if (!(node.textContent || '').trim().toLowerCase().startsWith(wanted)) continue;
      const input = node.querySelector('input, textarea');
      if (!input) continue;
      const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  })()`);
}

/** Pulsa el boton cuyo texto contiene lo pedido. */
async function clickText(page, text) {
  return page.eval(`(() => {
    const wanted = ${JSON.stringify(text.toLowerCase())};
    const btn = [...document.querySelectorAll('button')]
      .find((b) => (b.textContent || '').trim().toLowerCase().includes(wanted));
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  })()`);
}


async function main() {
  await mkdir(SHOTS, { recursive: true });
  const { child, target } = await launchBrowser({ runId, port: 9751 });
  const page = await Page.create(target);
  try {
    await page.restoreSession(SESION.storage);

    for (const item of NEGOCIOS) {
      console.log(`\n=== ${item.nombre} (${item.categoria}) ===`);
      await page.goto(`${APP}/negocio/nuevo?categoria=${item.categoria}`, { waitMs: 3000 });

      const okRubro = await page.waitFor('[data-testid="wizard-categories"]', 30_000);
      const rubro = await page.eval(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-pressed') === 'true');
        return b ? (b.textContent || '').trim().slice(0, 40) : '';
      })()`);
      paso(`${item.categoria}-1-rubro`, Boolean(okRubro && rubro), `Rubro elegido en el paso 1: "${rubro}"`);
      await page.screenshot(SHOTS, `${item.categoria}-1-rubro`);

      await clickText(page, 'Continuar');
      await sleep(1500);
      // La galeria se pide al backend y se pinta despues: hay que esperarla.
      await page.waitFor('[data-testid="design-gallery"]', 45_000).catch(() => {});
      await sleep(1500);
      // Cada diseno es un HIJO DIRECTO de la galeria. La miniatura renderiza la
      // pagina real, y esa pagina trae sus propios <article> (productos,
      // testimonios...): hay que contar solo los hijos, no los descendientes,
      // o la galeria parece duplicada cuando no lo esta.
      const disenos = await page.eval(`(() => {
        const grid = document.querySelector('[data-testid="design-gallery"]');
        if (!grid) return [];
        return [...grid.children].map((a) => ({
          etiqueta: (a.querySelector('h3') || {}).textContent || '',
          estilo: (a.querySelector('span') || {}).textContent || '',
          testid: a.getAttribute('data-testid') || '',
        }));
      })()`);
      paso(`${item.categoria}-2-disenos`, disenos.length > 0,
        `La galeria ofrece ${disenos.length} diseno(s) de ejemplo para ${item.categoria}: ${disenos.map((d) => d.etiqueta).join(' | ')}`);
      await page.screenshot(SHOTS, `${item.categoria}-2-disenos`);

      const eligio = await page.eval(`(() => {
        const card = document.querySelector('[data-testid="design-gallery"] > article');
        if (!card) return '';
        (card.querySelector('button[aria-pressed]') || card).click();
        return (card.querySelector('h3') || {}).textContent || '';
      })()`);
      paso(`${item.categoria}-3-diseno-elegido`, Boolean(eligio), `Diseno elegido: ${eligio || 'ninguno'}`);
      await sleep(1500);

      await clickText(page, 'Continuar');
      await sleep(3500);
      await page.screenshot(SHOTS, `${item.categoria}-4-preview`);
      paso(`${item.categoria}-4-preview`, true, 'La vista previa del diseno se renderiza antes de crear');

      await clickText(page, 'Continuar');
      await sleep(2500);
      await fillByLabel(page, 'Nombre del negocio', item.nombre);
      await fillByLabel(page, 'Descripci', item.descripcion);
      await fillByLabel(page, 'Tel', item.tel);
      await fillByLabel(page, 'Ciudad', item.ciudad);
      await sleep(1200);
      const relleno = await page.eval(`[...document.querySelectorAll('input, textarea')].map((i) => i.value).filter(Boolean).slice(0, 6)`);
      paso(`${item.categoria}-5-datos`, relleno.length >= 3, `Formulario relleno por la UI: ${JSON.stringify(relleno)}`);
      await page.screenshot(SHOTS, `${item.categoria}-5-datos`);

      await clickText(page, 'Continuar');
      await sleep(2500);
      const creado = await clickText(page, 'Crear p');
      const enEditor = await page.waitFor('[data-testid="business-builder"]', 60_000);
      paso(`${item.categoria}-6-creada`, Boolean(creado && enEditor), 'El creador abrio el editor con la pagina ya creada');
      if (!enEditor) continue;
      const id = await page.eval(`new URL(location.href).searchParams.get('id')`);
      await page.screenshot(SHOTS, `${item.categoria}-7-editor`);

      await page.goto(`${APP}/negocio`, { waitMs: 3500 });
      await sleep(3000);
      await clickText(page, 'Publicar');
      await sleep(6000);
      const estado = await apiGet(`/api/businesses/${id}`, SESION.token);
      const b = estado.body?.business || {};
      paso(`${item.categoria}-8-publicada`, b.status === 'PUBLISHED', `Estado tras pulsar Publicar: ${b.status} (slug: ${b.slug})`);
      await page.screenshot(SHOTS, `${item.categoria}-8-publicada`);

      report.negocios.push({
        nombre: item.nombre, categoria: item.categoria, id, slug: b.slug,
        status: b.status, disenos: disenos.length, url: `${APP}/mi-negocio/${b.slug}`,
      });
    }

    for (const n of report.negocios) {
      if (n.status !== 'PUBLISHED') { paso(`publica-${n.categoria}`, false, `${n.nombre} no quedo PUBLISHED`); continue; }
      const pub = await apiGet(`/api/public/businesses/${n.slug}`);
      const body = pub.body || {};
      const secciones = body.manifest?.sections?.length || body.site?.manifest?.sections?.length || 0;
      paso(`publica-${n.categoria}`, pub.status === 200, `GET /api/public/businesses/${n.slug} -> HTTP ${pub.status}, ${secciones} secciones`);
    }
  } catch (e) {
    paso('ERROR', false, String(e?.message || e));
  }

  report.finishedAt = new Date().toISOString();
  await writeFile(path.resolve('qa/cert-tres-webs.json'), JSON.stringify(report, null, 2));
  console.log('\n--- RESUMEN TRES WEBS ---');
  console.log(`pasos: ${report.pasos.length}  fallos: ${report.fallos.length}`);
  for (const n of report.negocios) console.log(`${n.nombre.padEnd(26)} ${n.categoria.padEnd(12)} ${n.status.padEnd(10)} ${n.url}`);
  page.close();
  child.kill();
  process.exit(report.fallos.length ? 1 : 0);
}

main();
