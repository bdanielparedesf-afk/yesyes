/** Verifica que el asistente ofrezca "Empezar con contenido de ejemplo". */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Page, launchBrowser, sleep } from './driver.mjs';

const SHOTS = path.resolve('qa/cert-captures', 'wizard-ejemplo');
await mkdir(SHOTS, { recursive: true });
const NEGOCIO = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const { child, target } = await launchBrowser({ runId: 'wizard-ejemplo', port: 9795 });
const page = await Page.create(target);
await page.restoreSession(NEGOCIO.storage);
await page.goto('http://127.0.0.1:5173/negocio/nuevo?categoria=BARBER', { waitMs: 30000 });
await sleep(5000);

// Saltar al paso 4 (Información básica) donde vive la casilla.
for (let i = 0; i < 3; i += 1) {
  await page.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /^Continuar/.test((x.textContent || '').trim()));
    b && b.click();
  })()`);
  await sleep(2500);
}
await page.eval(`(() => {
  const i = document.querySelector('input[type="text"]');
  if (i) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(i, 'Barberia QA Ejemplo');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }
})()`);
await sleep(1200);

const estado = await page.eval(`(() => {
  const box = [...document.querySelectorAll('input[type="checkbox"]')][0];
  const texto = (document.body.textContent || '');
  return {
    hayCasilla: Boolean(box),
    marcadaPorDefecto: box ? box.checked : null,
    mencionaEjemplo: /Empezar con contenido de ejemplo/.test(texto),
  };
})()`);
console.log('ASISTENTE:', JSON.stringify(estado, null, 2));
await page.screenshot(SHOTS, 'wizard-casilla-ejemplo');
page.close();
child.kill();
process.exit(0);
