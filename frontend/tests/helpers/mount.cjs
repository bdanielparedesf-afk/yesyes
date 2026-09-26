const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const esbuild = require('esbuild');

const SRC = path.join(__dirname, '../../src');
// El bundle se escribe DENTRO del proyecto: si viviera en %TEMP%, los
// `external` (react, react-dom) no se podrían resolver desde ahí. La carpeta es
// ÚNICA por proceso: `node --test` corre los archivos en paralelo y, si todos
// compartieran el mismo directorio, la limpieza de uno rompería el esbuild del otro.
const OUT = path.join(__dirname, '..', '.tmp-mount', `${process.pid}`);
fs.mkdirSync(OUT, { recursive: true });
process.on('exit', () => { try { fs.rmSync(OUT, { recursive: true, force: true }); } catch { /* best effort */ } });

/**
 * Monta un módulo REAL del frontend (TS/TSX) con esbuild y lo ejecuta. React,
 * react-dom y lucide-react quedan externos para no duplicar copias.
 */
function mount(entryFile, name) {
  // Rutas con barra normal: esbuild las resuelve como specifiers absolutos.
  const target = path.join(SRC, entryFile).replace(/\\/g, '/');
  const entry = path.join(OUT, `${name}.tsx`);
  fs.writeFileSync(entry, `
export * from ${JSON.stringify(target)};
import Subject from ${JSON.stringify(target)};
export { Subject };
`);
  const outfile = path.join(OUT, `${name}.cjs`);
  esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/server', 'lucide-react', 'axios', 'framer-motion', 'dayjs', 'react-router-dom'],
    define: { 'process.env.NODE_ENV': '"test"' },
    logLevel: 'silent',
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl' },
    tsconfigRaw: {
      compilerOptions: {
        baseUrl: SRC.replace(/\\/g, '/'),
        paths: { '@/*': ['*'] },
        jsx: 'react-jsx',
        target: 'es2020',
        module: 'esnext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  });
  delete require.cache[outfile];
  return require(outfile);
}

module.exports = { mount, SRC, OUT };
