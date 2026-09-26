/** Lista los negocios de la sesion de certificacion (solo lectura). */
import { readFile } from 'node:fs/promises';

const n = JSON.parse(await readFile('qa/cert-negocio.json', 'utf8'));
const r = await fetch('http://localhost:3001/api/businesses', {
  headers: { Authorization: `Bearer ${n.token}` },
});
const d = await r.json();
const lista = d.businesses || d;
for (const b of lista) {
  console.log(`${String(b.name).padEnd(28)} ${String(b.category).padEnd(12)} ${String(b.status).padEnd(9)} ${b.slug}`);
}
console.log('total', lista.length);
