/**
 * Borra los items de PRUEBA que dejo la certificacion de edicion.
 * Idempotente: se puede correr las veces que haga falta.
 */
import { readFile } from 'node:fs/promises';
const N = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const H = { Authorization: `Bearer ${N.token}`, 'Content-Type': 'application/json' };
const base = `http://127.0.0.1:3001/api/businesses/${N.id}`;

const srv = await (await fetch(`${base}/services`, { headers: H })).json();
for (const s of srv.services.filter((x) => /PRUEBA|EDITADO/.test(x.name || ''))) {
  await fetch(`${base}/services/${s.id}`, { method: 'DELETE', headers: H });
  console.log('servicio borrado:', s.name);
}
const prods = await (await fetch(`${base}/products`, { headers: H })).json();
for (const p of prods.products.filter((x) => /PRUEBA|EDITADO/.test(x.name || ''))) {
  await fetch(`${base}/products/${p.id}`, { method: 'DELETE', headers: H });
  console.log('producto borrado:', p.name);
}
for (const sec of ['team', 'faqs', 'testimonials', 'promotions']) {
  const all = await (await fetch(`${base}/content`, { headers: H })).json();
  for (const item of (all[sec] || []).filter((x) => /PRUEBA|EDITADO/.test(JSON.stringify(x)))) {
    await fetch(`${base}/content/${sec}/${item.id}`, { method: 'DELETE', headers: H });
    console.log(`${sec} borrado:`, item.name || item.title || item.question);
  }
}
// La galeria de prueba quedo con 2 fotos de Unsplash.
await fetch(`${base}/gallery`, { method: 'PUT', headers: H, body: JSON.stringify({ images: [] }) });
console.log('galeria de prueba limpiada');
