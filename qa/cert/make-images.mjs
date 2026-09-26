/**
 * Genera ARCHIVOS REALES para la fase de medios: imagenes PNG.
 *
 * No son fixtures del negocio: son los archivos que el usuario "adjuntaria"
 * desde su disco. Se escriben con un codificador propio para no depender de
 * ffmpeg/sharp, que no estan en el entorno.
 *
 *   node qa/cert/make-images.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

export const OUT = path.resolve('qa/cert-media');
await mkdir(OUT, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
/** PNG real de `width`x`height`: degradado + franja de acento distinguible. */
function png(width, height, [r, g, b]) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; offset += 1;
    for (let x = 0; x < width; x += 1) {
      const t = x / width;
      const u = y / height;
      raw[offset] = Math.round(r * (1 - t * 0.55) + 40 * t);
      raw[offset + 1] = Math.round(g * (1 - t * 0.55) + 90 * t);
      raw[offset + 2] = Math.round(b * (1 - t * 0.55) + 140 * t);
      if (u > 0.82) { raw[offset] = 235; raw[offset + 1] = 190; raw[offset + 2] = 90; }
      offset += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const IMAGES = [
  ['hero-aurora.png', 1600, 900, [188, 108, 76]],
  ['plato-hamburguesa.png', 900, 700, [176, 84, 62]],
  ['plato-pizza.png', 900, 700, [190, 118, 58]],
  ['plato-pasta.png', 900, 700, [150, 122, 84]],
  ['postre-aurora.png', 900, 700, [166, 96, 128]],
  ['galeria-salon.png', 1100, 800, [120, 96, 84]],
  ['galeria-jardin.png', 1100, 800, [96, 132, 96]],
  ['equipo-cocina.png', 1100, 800, [140, 140, 150]],
  ['carta-vinos.png', 1100, 800, [110, 70, 90]],
];
for (const [name, w, h, color] of IMAGES) {
  await writeFile(path.join(OUT, name), png(w, h, color));
  console.log('PNG', name, `${w}x${h}`);
}
console.log('OK ->', OUT);
