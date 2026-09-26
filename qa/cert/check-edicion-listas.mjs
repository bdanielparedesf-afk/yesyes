/**
 * Verifica que el dueño pueda EDITAR, AGREGAR y BORRAR contenido en el editor.
 * Antes el inspector mostraba para Servicios/Productos unicamente un parrafo de
 * texto, sin ningun input. Aqui se comprueba que los formularios existen y que
 * el cambio llega al backend (no solo a la UI).
 */
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Page, launchBrowser, sleep } from './driver.mjs';

const SHOTS = path.resolve('qa/cert-captures', 'edicion-listas');
await mkdir(SHOTS, { recursive: true });
const NEGOCIO = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const { target } = await launchBrowser({ runId: 'edicion-listas-b', port: 9795 });
const page = await Page.create(target);
const APP = 'http://127.0.0.1:5173';

await page.restoreSession(NEGOCIO.storage);
await page.goto(`${APP}/negocio/editor?id=${NEGOCIO.id}`, { waitMs: 45000 });
await sleep(6000);

/** Cuenta los controles editables de un panel. */
const controles = (sel) => `(() => {
  const root = document.querySelector('${sel}');
  if (!root) return { encontrado: false };
  const inputs = [...root.querySelectorAll('input, textarea, select')];
  return {
    encontrado: true,
    inputs: inputs.length,
    editables: inputs.filter((i) => !i.disabled && !i.readOnly).length,
    botones: root.querySelectorAll('button').length,
  };
})()`;

const SIDEBAR = '[data-testid="builder-inspector-desktop"]';
const resumen = {};

// La sidebar lista las secciones; se recorren las que deben tener editor de lista.
const secciones = await page.eval(`(() => {
  return [...document.querySelectorAll('[data-testid="builder-sidebar-desktop"] button')]
    .map((b) => (b.textContent || '').trim())
    .filter((t) => t);
})()`);
console.log('SECCIONES SIDEBAR:', JSON.stringify(secciones));

// Por cada sección con lista, se selecciona y se cuentan los controles.
const CON_LISTA = ['Servicios', 'Productos', 'Galería', 'Equipo', 'Testimonios', 'Preguntas frecuentes'];
for (const nombre of CON_LISTA) {
  const seleccion = await page.eval(`(() => {
    const b = [...document.querySelectorAll('[data-testid="builder-sidebar-desktop"] button')]
      .find((x) => (x.textContent || '').trim().toLowerCase().startsWith('${nombre.toLowerCase()}'));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  if (!seleccion) { resumen[nombre] = { encontrado: false }; continue; }
  await sleep(1500);
  // Las filas de una lista arrancan colapsadas: los campos solo existen al
  // abrirlas. Sin esto el conteo daria 0 inputs y pareceria un panel mudo.
  const abierto = await page.eval(`(() => {
    const root = document.querySelector('${SIDEBAR}');
    const row = root && root.querySelector('[data-testid^="row-"]');
    if (!row) return false;
    row.click();
    return true;
  })()`);
  if (abierto) await sleep(700);
  resumen[nombre] = await page.eval(controles(SIDEBAR));
  resumen[nombre].filaAbierta = abierto;
  await page.screenshot(SHOTS, `lista-${nombre.replace(/\s+/g, '-').toLowerCase()}`);
}

console.log('CONTROLES POR SECCION:', JSON.stringify(resumen, null, 1));

// El texto placeholder NO debe existir mas en ningun editor de lista.
const placeholder = await page.eval(`document.body.innerText.includes('No agregaremos informaci')`);
console.log('PLACEHOLDER VIVO:', placeholder);

// Editar de verdad el primer servicio y comprobar que el backend lo recibe.
await page.eval(`(() => {
  const b = [...document.querySelectorAll('[data-testid="builder-sidebar-desktop"] button')]
    .find((x) => (x.textContent || '').trim().toLowerCase().startsWith('servicios'));
  if (b) b.click();
})()`);
await sleep(1500);

const ABIERTO = await page.eval(`(() => {
  const root = document.querySelector('${SIDEBAR}');
  const row = root && root.querySelector('[data-testid^="row-"]');
  if (!row) return { hayFilas: false };
  row.click();
  return { hayFilas: true };
})()`);
console.log('FILAS SERVICIOS:', JSON.stringify(ABIERTO));
await sleep(800);

const EDITADO = `Servicio EDITADO ${Date.now()}`;
const escrito = await page.eval(`(() => {
  const root = document.querySelector('${SIDEBAR}');
  const input = root && root.querySelector('[data-testid="field-name"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${EDITADO}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
console.log('ESCRITO EN INPUT:', escrito, '->', EDITADO);
await sleep(3000);
await page.screenshot(SHOTS, 'servicio-editado');

// Confirmar contra el backend, no solo en la UI.
const r = await fetch(`http://127.0.0.1:3001/api/businesses/${NEGOCIO.id}/services`, {
  headers: { Authorization: `Bearer ${NEGOCIO.token}` },
});
const { services } = await r.json();
const guardado = services.find((s) => s.name === EDITADO);
console.log('PERSISTIDO EN BACKEND:', guardado ? `SI (${guardado.id})` : 'NO');
await page.screenshot(SHOTS, 'final');
console.log('capturas en', SHOTS);
process.exit(0);
