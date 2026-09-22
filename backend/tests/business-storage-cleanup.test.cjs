const { test } = require('node:test');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { deleteBusinessImages } = require('../src/lib/storage.ts');

const BIZ = 'biz-123';
const OTRO = 'biz-999';

/** Store falso en memoria que imita la API de Supabase Storage (carpetas sin id). */
function fakeStore(paths, opts = {}) {
  const tree = new Map();
  const calls = { list: [], remove: [] };
  for (const p of paths) {
    const parts = p.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      const isFile = i === parts.length - 1;
      if (!tree.has(parent)) tree.set(parent, new Map());
      tree.get(parent).set(parts[i], { name: parts[i], id: isFile ? 'obj-' + p : null });
    }
  }
  const files = () => {
    const out = [];
    for (const [parent, entries] of tree) {
      for (const e of entries.values()) if (e.id) out.push(parent ? `${parent}/${e.name}` : e.name);
    }
    return out.sort();
  };
  return {
    calls,
    files,
    list: async (prefix, options) => {
      calls.list.push({ prefix, limit: options && options.limit });
      if (opts.failList) return { data: null, error: { message: 'list boom' } };
      return { data: Array.from((tree.get(prefix) || new Map()).values()), error: null };
    },
    remove: async (batch) => {
      calls.remove.push([...batch]);
      if (opts.failRemove) return { error: { message: 'remove boom' } };
      for (const p of batch) {
        const parts = p.split('/');
        const parent = parts.slice(0, -1).join('/');
        const entries = tree.get(parent);
        if (entries) entries.delete(parts[parts.length - 1]);
      }
      return { error: null };
    },
  };
}

test('deleteBusinessImages borra recursivamente logo, cover y galeria del negocio', async () => {
  const store = fakeStore([
    `${BIZ}/logo/a.png`,
    `${BIZ}/cover/b.jpg`,
    `${BIZ}/gallery/c.png`,
    `${BIZ}/gallery/d.png`,
    `${BIZ}/service/e.png`,
    `${BIZ}/property/f.png`,
  ]);
  const removed = await deleteBusinessImages(BIZ, store);
  assert.equal(removed, 6);
  assert.deepEqual(store.files(), []);
  assert.equal(store.calls.remove.length, 1);
  // 1 listado raiz + 1 por cada subcarpeta (logo, cover, gallery, service, property)
  assert.equal(store.calls.list.length, 6);
  assert.equal(store.calls.list[0].prefix, BIZ);
  assert.ok(store.calls.list.every(c => c.limit === 1000));
  for (const batch of store.calls.remove) for (const p of batch) assert.ok(p.startsWith(`${BIZ}/`), `ruta fuera del prefijo: ${p}`);
});

test('deleteBusinessImages no toca objetos de otros negocios', async () => {
  const store = fakeStore([`${BIZ}/logo/a.png`, `${OTRO}/logo/otro.png`, `${OTRO}/gallery/x.png`]);
  const removed = await deleteBusinessImages(BIZ, store);
  assert.equal(removed, 1);
  assert.deepEqual(store.files(), [`${OTRO}/gallery/x.png`, `${OTRO}/logo/otro.png`]);
  assert.ok(store.calls.remove.flat().every(p => p.startsWith(`${BIZ}/`)));
});

test('deleteBusinessImages ignora businessId vacio, con separadores o traversal', async () => {
  for (const bad of ['', '   ', 'a/b', '..', '../../etc', `${BIZ}\\x`]) {
    const store = fakeStore([`${BIZ}/logo/a.png`]);
    assert.equal(await deleteBusinessImages(bad, store), 0);
    assert.equal(store.calls.list.length, 0);
    assert.equal(store.calls.remove.length, 0);
    assert.deepEqual(store.files(), [`${BIZ}/logo/a.png`]);
  }
});

test('deleteBusinessImages devuelve 0 y no llama remove si no hay objetos', async () => {
  const store = fakeStore([]);
  assert.equal(await deleteBusinessImages(BIZ, store), 0);
  assert.equal(store.calls.list.length, 1);
  assert.equal(store.calls.remove.length, 0);
});

test('deleteBusinessImages ignora el placeholder de carpeta vacia', async () => {
  const store = fakeStore([`${BIZ}/logo/${'.emptyFolderPlaceholder'}`]);
  assert.equal(await deleteBusinessImages(BIZ, store), 0);
  assert.equal(store.calls.remove.length, 0);
  assert.deepEqual(store.files(), [`${BIZ}/logo/.emptyFolderPlaceholder`]);
});

test('deleteBusinessImages borra en lotes de 100', async () => {
  const paths = Array.from({ length: 150 }, (_, i) => `${BIZ}/gallery/${i}.png`);
  const store = fakeStore(paths);
  const removed = await deleteBusinessImages(BIZ, store);
  assert.equal(removed, 150);
  assert.equal(store.calls.remove.length, 2);
  assert.equal(store.calls.remove[0].length, 100);
  assert.equal(store.calls.remove[1].length, 50);
  assert.deepEqual(store.files(), []);
});

test('deleteBusinessImages propaga errores con status 502', async () => {
  const failRemove = fakeStore([`${BIZ}/logo/a.png`], { failRemove: true });
  await assert.rejects(() => deleteBusinessImages(BIZ, failRemove), (err) => {
    assert.equal(err.status, 502);
    assert.match(err.message, /Error eliminando imagenes/);
    assert.match(err.message, /remove boom/);
    return true;
  });
  const failList = fakeStore([`${BIZ}/logo/a.png`], { failList: true });
  await assert.rejects(() => deleteBusinessImages(BIZ, failList), (err) => {
    assert.equal(err.status, 502);
    assert.match(err.message, /Error listando imagenes/);
    return true;
  });
});
