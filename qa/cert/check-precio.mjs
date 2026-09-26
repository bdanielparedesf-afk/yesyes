/** Verifica en la home real que el precio del plan ya NO sea 0. */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Page, launchBrowser, sleep } from './driver.mjs';

const SHOTS = path.resolve('qa/cert-captures', 'precio');
await mkdir(SHOTS, { recursive: true });
const { child, target } = await launchBrowser({ runId: 'precio', port: 9771 });
const page = await Page.create(target);
await page.goto('http://127.0.0.1:5173/', { waitMs: 4000 });
await page.waitFor('[data-testid="business-builder"], #yesyes-business', 45_000).catch(() => {});
await sleep(6000);
const info = await page.eval(`(() => {
  const seccion = document.querySelector('#yesyes-business');
  if (!seccion) return { error: 'no esta la seccion YesYes Business' };
  const textos = [...seccion.querySelectorAll('p, span, div')]
    .map((n) => (n.textContent || '').trim())
    .filter((t) => /\\$\\s?[\\d.]+|CLP|Consulta el precio/.test(t));
  return { precios: [...new Set(textos)].slice(0, 6) };
})()`);
console.log(JSON.stringify(info, null, 2));
await page.screenshot(SHOTS, 'precio-home');
page.close();
child.kill();
process.exit(0);
