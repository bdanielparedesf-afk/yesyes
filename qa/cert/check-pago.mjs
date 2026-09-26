/**
 * Verifica el modal de cobro: al publicar sin plan debe abrirse, mostrar el
 * precio real y ofrecer un botón de pago. Antes solo salía un texto crudo sin
 * precio ni forma de pagar.
 */
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Page, launchBrowser, sleep } from './driver.mjs';

const SHOTS = path.resolve('qa/cert-captures', 'pago');
await mkdir(SHOTS, { recursive: true });
const NEGOCIO = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const { target } = await launchBrowser({ runId: 'pago', port: 9797 });
const page = await Page.create(target);

await page.restoreSession(NEGOCIO.storage);
await page.goto(`http://127.0.0.1:5173/negocio/editor?id=${NEGOCIO.id}`, { waitMs: 45000 });
await sleep(6000);

// El botón Publicar está en la barra superior.
// `b.click()` desde eval() no siempre llega al handler de React: se usa el
// testid del boton y se despacha un evento de puntero completo.
const BTN = '[data-testid="builder-publish"]';
const existe = await page.eval(`(() => !!document.querySelector('${BTN}'))()`);
console.log('EXISTE builder-publish:', existe);

if (existe) {
  const box = await page.eval(`(() => {
    const b = document.querySelector('${BTN}');
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  console.log('CLICK en', JSON.stringify(box));
}
await sleep(6000);
await page.screenshot(SHOTS, '01-modal');

const modal = await page.eval(`(() => {
  const d = document.querySelector('[data-testid="publish-payment-dialog"]');
  if (!d) return { abierto: false };
  const precio = d.querySelector('[data-testid="plan-price"]');
  return {
    abierto: true,
    titulo: (d.querySelector('#pay-title') || {}).textContent || '',
    precio: precio ? precio.textContent.trim() : null,
    texto: d.innerText,
    botonPagar: !!d.querySelector('[data-testid="pay-button"]'),
    etiquetaBoton: (d.querySelector('[data-testid="pay-button"]') || {}).textContent || '',
  };
})()`);
console.log('MODAL:', JSON.stringify(modal, null, 1));
console.log('--- TEXTO COMPLETO ---');
console.log(modal.texto || '(sin modal)');
process.exit(0);
