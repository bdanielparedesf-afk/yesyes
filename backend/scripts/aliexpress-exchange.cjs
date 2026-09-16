'use strict';
// Backend-only: supply a fresh authorization code on stdin, never as argv.
// Does not print the request, credentials, account or returned tokens.
const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../.env') });
require('tsx/cjs');
const { connectAliExpress } = require('../src/services/aliexpress-token.service.ts');
const { prisma } = require('../src/lib/prisma.ts');

async function main() {
  if (process.argv.length !== 2 || process.stdin.isTTY) {
    throw new Error('INPUT_REQUIRED');
  }
  if (process.env.ALIEXPRESS_APP_KEY !== '547536' || !process.env.ALIEXPRESS_APP_SECRET?.trim()
    || !/^[a-f\d]{64}$/i.test(process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY || '')) {
    throw new Error('CONFIGURATION');
  }
  const code = await new Promise((resolveCode, reject) => {
    const chunks = [];
    let length = 0;
    const timer = setTimeout(() => { process.stdin.destroy(); reject(new Error('INPUT_TIMEOUT')); }, 30000);
    process.stdin.on('data', chunk => {
      length += chunk.length;
      if (length > 4096) { clearTimeout(timer); process.stdin.destroy(); reject(new Error('INVALID_INPUT')); return; }
      chunks.push(chunk);
    });
    process.stdin.once('end', () => { clearTimeout(timer); resolveCode(Buffer.concat(chunks).toString('utf8').trim()); });
    process.stdin.once('error', () => { clearTimeout(timer); reject(new Error('INVALID_INPUT')); });
  });
  if (!code) throw new Error('INVALID_INPUT');
  await connectAliExpress(code);
  process.stdout.write('Autorización guardada cifrada. Acceso Dropshipping todavía no verificado.\n');
}

main().catch(() => {
  process.stderr.write('No se completó el canje. Verifica configuración backend, entrada y almacenamiento; no se reintentó el código.\n');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
