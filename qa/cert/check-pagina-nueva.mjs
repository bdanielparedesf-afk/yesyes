/** Captura la pagina publica recien creada con contenido de ejemplo. */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Page, launchBrowser, sleep } from './driver.mjs';

const SHOTS = path.resolve('qa/cert-captures', 'pagina-nueva');
await mkdir(SHOTS, { recursive: true });
const NEGOCIO = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const id = (await readFile('qa/nuevo-id.txt', 'utf8')).trim();
const token = (await readFile('qa/preview-token.txt', 'utf8')).trim();

const { child, target } = await launchBrowser({ runId: 'pagina-nueva-b', port: 9801 });
const page = await Page.create(target);
await page.goto(
  `http://127.0.0.1:5173/mi-negocio/restaurante-la?preview=${token}`,
  { waitMs: 30000 },
);
await sleep(8000);

const info = await page.eval(`(() => ({
  titulo: document.title,
  h1: (document.querySelector('h1')?.innerText || '').trim(),
  secciones: [...document.querySelectorAll('h2')].map((n) => n.innerText.trim()).slice(0, 12),
  largo: (document.body.innerText || '').length,
}))()`);
console.log('PORTADA:', JSON.stringify(info, null, 2));
await page.screenshot(SHOTS, '01-portada');

// Recorre la pagina para capturar el resto de secciones con contenido real.
for (const [i, etiqueta] of ['servicios', 'productos', 'contacto'].entries()) {
  await page.eval(`window.scrollTo(0, document.body.scrollHeight * ${i + 1} / 3)`);
  await sleep(1500);
  await page.screenshot(SHOTS, `0${i + 2}-seccion-${etiqueta}`);
}

const conteo = await page.eval(`(() => ({
  preguntas: document.querySelectorAll('details').length,
}))()`);
console.log('CONTEOS:', JSON.stringify(conteo));
console.log('API id:', id);
console.log('capturas en', SHOTS);

if (page.consoleErrors.length) console.log('ERRORES CONSOLA:', page.consoleErrors.slice(0, 5));
if (page.pageErrors.length) console.log('ERRORES PAGINA:', page.pageErrors.slice(0, 5));
page.close();
child.kill();
process.exit(0);
