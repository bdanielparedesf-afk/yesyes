import { APP, Page, launchBrowser } from './driver.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Genera un video REAL usando el encoder del propio navegador.
 *
 * Se dibuja una animacion en un canvas y se graba con MediaRecorder. El archivo
 * resultante esta realmente codificado (VP8/VP9 en WebM), no es un contenedor
 * con datos inventados: por eso el navegador lo reproduce y la fase de video
 * prueba decodificacion de verdad, no la existencia de un <video>.
 */
const OUT = path.resolve('qa/cert-media');
await mkdir(OUT, { recursive: true });

const { child, target, port } = await launchBrowser({ runId: 'make-video', port: 9721 });
const page = await Page.create(target);
await page.goto(`${APP}/`, { waitMs: 1500 });

const result = await page.eval(`(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 540;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(25);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) return null;
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
  const parts = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  const done = new Promise((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start();
  const started = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const t = (performance.now() - started) / 1000;
      const g = ctx.createLinearGradient(0, 0, 960, 540);
      g.addColorStop(0, 'hsl(' + (20 + t * 40) + ',62%,46%)');
      g.addColorStop(1, 'hsl(' + (200 + t * 30) + ',48%,32%)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Casa Aurora', 480, 250);
      ctx.font = '28px sans-serif';
      ctx.fillText('Cocina de temporada · ' + t.toFixed(1) + 's', 480, 300);
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = t * 1000 > i * 550 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.22)';
        ctx.beginPath(); ctx.arc(300 + i * 90, 400, 26, 0, Math.PI * 2); ctx.fill();
      }
      if (t < 3) requestAnimationFrame(draw); else resolve();
    };
    draw();
  });
  recorder.stop();
  await done;
  const blob = new Blob(parts, { type: mime });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return { mime, base64: btoa(binary), size: bytes.length };
})()`);

if (!result) { console.error('BLOCKED_EXTERNAL_DEPENDENCY: MediaRecorder no soportado en este navegador'); process.exit(1); }
const buffer = Buffer.from(result.base64, 'base64');
const name = 'cocina-aurora.webm';
await writeFile(path.join(OUT, name), buffer);
console.log('VIDEO', name, result.mime, `${(buffer.length / 1024).toFixed(0)} KB`);
page.close();
child.kill();
process.exit(0);
