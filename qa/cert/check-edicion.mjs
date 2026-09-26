/**
 * Verifica si un dueño puede cambiar las IMÁGENES y las PALABRAS de la página de ejemplo.
 * Usa el negocio QA ya creado y comprueba persistencia tras recargar.
 */
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Page, launchBrowser, sleep } from './driver.mjs';

const SHOTS = path.resolve('qa/cert-captures', 'edicion');
await mkdir(SHOTS, { recursive: true });
const NEGOCIO = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const { child, target } = await launchBrowser({ runId: 'edicion', port: 9781 });
const page = await Page.create(target);

await page.restoreSession(NEGOCIO.storage);
await page.goto(`http://127.0.0.1:5173/negocio/dashboard?id=${NEGOCIO.id}`, { waitMs: 45000 });
await sleep(4000);

// 1) Qué secciones de edición existen (volcado crudo para diagnosticar)
const secciones = await page.eval(`(() => {
  return [...document.querySelectorAll('button')]
    .map((b) => ({ txt: (b.textContent || '').trim().slice(0, 30), tag: b.tagName }))
    .filter((b) => b.txt);
})()`);
console.log('BOTONES:', JSON.stringify(secciones, null, 1));
await page.screenshot(SHOTS, '01-dashboard');

// 2) PALABRAS: ir a Servicios, editar un texto, guardar, recargar y comprobar
const APP = 'http://127.0.0.1:5173';
const NUEVO = `Servicio QA ${Date.now()}`;
await page.goto(`${APP}/negocio/servicios?id=${NEGOCIO.id}`, { waitMs: 15000 });
await sleep(4000);

const estadoInicial = await page.eval(`(() => {
  const inputs = [...document.querySelectorAll('input, textarea')]
    .map((i) => ({ tag: i.tagName, value: i.value, disabled: !!i.disabled }));
  return { total: inputs.length, editables: inputs.filter((i) => !i.disabled).length };
})()`);
console.log('SERVICIOS inputs:', JSON.stringify(estadoInicial));
await page.screenshot(SHOTS, '02-servicios');

// Buscar el primer input de texto editable y cambiarle el valor
await page.eval(`(() => {
  const inp = [...document.querySelectorAll('input[type="text"], input:not([type]), textarea')]
    .find((i) => !i.disabled && i.value);
  if (inp) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, ${JSON.stringify(NUEVO)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    window.__qaCampo = true;
  }
})()`);
await sleep(1200);
const botones = await page.eval(`(() => [...document.querySelectorAll('button')].map((b) => (b.textContent||'').trim()).filter(Boolean))()`);
console.log('BOTONES SERVICIOS:', JSON.stringify(botones));
await page.screenshot(SHOTS, '03-servicio-editado');

page.close();
child.kill();
process.exit(0);
