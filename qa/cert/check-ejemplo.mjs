/** Comprueba que el contenido de ejemplo SIEMBRA existe y se ve en la página real. */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Page, launchBrowser, sleep } from './driver.mjs';

const SHOTS = path.resolve('qa/cert-captures', 'ejemplo-real');
await mkdir(SHOTS, { recursive: true });
const NEGOCIO = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const { child, target } = await launchBrowser({ runId: 'ejemplo-real', port: 9791 });
const page = await Page.create(target);
await page.restoreSession(NEGOCIO.storage);
await page.goto(`http://127.0.0.1:5173/negocio/servicios?id=${NEGOCIO.id}`, { waitMs: 30000 });
await sleep(4000);
const info = await page.eval(`(() => {
  const textos = [...document.querySelectorAll('li, p, h3, span')]
    .map((n) => (n.textContent || '').trim())
    .filter((t) => /Plato de la casa|Menú del día|Tabla para compartir|Combo familiar|Aún no tienes/.test(t));
  return [...new Set(textos)].slice(0, 8);
})()`);
console.log('SERVICIOS EN PANTALLA:', JSON.stringify(info, null, 2));
await page.screenshot(SHOTS, 'servicios-con-ejemplo');
page.close();
child.kill();
process.exit(0);
