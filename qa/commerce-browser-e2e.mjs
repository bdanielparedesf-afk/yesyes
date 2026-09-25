import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const apiBase = 'http://127.0.0.1:3001';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pickRealStoreProduct(payload) {
  const products = payload?.products || [];
  for (const product of products) {
    const variants = product.productVariants || [];
    if (product.businessId || (product.status && product.status !== 'PUBLISHED') || product.hidden) continue;
    if (variants.length) {
      const variant = variants.find((item) => Number(item.stock) >= 2 && Number(item.price) > 0);
      if (variant) return { product, variant };
    } else if (Number(product.stock) >= 2 && Number(product.salePrice) > 0) {
      return { product, variant: null };
    }
  }
  throw new Error('La API no devolvió un producto Store publicado, visible y disponible con stock suficiente');
}

function trustedCheckout(items) {
  const result = spawnSync(process.execPath, [
    path.resolve('backend/node_modules/tsx/dist/cli.mjs'),
    path.resolve('qa/trusted-checkout.ts'),
    JSON.stringify({ items }),
  ], { encoding: 'utf8', cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test' }, timeout: 20_000, killSignal: 'SIGTERM' });
  if (result.error?.code === 'ETIMEDOUT') throw new Error('El backend no pudo recalcular checkout: TIMEOUT');
  if (result.status !== 0) throw new Error(`El backend no pudo recalcular checkout: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
}

export async function runCommerceBrowserE2E({ client, evaluate, wait, clickText }) {
  const response = await fetch(`${apiBase}/api/products?limit=100`, { signal: AbortSignal.timeout(15_000) });
  assert(response.ok, `GET /api/products: HTTP ${response.status}`);
  const selected = pickRealStoreProduct(await response.json());
  const { product, variant } = selected;
  const expectedVariantLabel = variant ? Object.entries({ Color: variant.color, Talla: variant.size, Size: variant.size }).find(([, value]) => value)?.[1] : null;
  const expectedFrontendPrice = Number(variant?.finalPrice ?? variant?.price ?? product.salePrice);
  const expectedPrice = Number(variant?.price ?? product.salePrice);
  const results = {
    product: 'FAIL', cart: 'FAIL', persistence: 'FAIL', checkout: 'FAIL', backendAuthority: 'FAIL',
    productId: product.id, slug: product.slug, variantId: variant?.id || null, expectedPrice,
  };

  await client.send('Page.navigate', { url: `http://127.0.0.1:5173/productos/${encodeURIComponent(product.slug)}` });
  await wait(`document.querySelector('h1') && !document.querySelector('[aria-busy="true"]') && !document.body.innerText.includes('Cargando producto')`, 30_000, 'producto real cargado');
  if (variant) {
    const selectionAttempt = await evaluate(`(()=>{const value=${JSON.stringify(expectedVariantLabel)};const n=[...document.querySelectorAll('button')].find(x=>!x.disabled&&(x.textContent||'').trim()===value);if(n)n.click();return {clicked:!!n,value,buttons:[...document.querySelectorAll('button')].map(x=>({text:(x.textContent||'').trim(),aria:x.getAttribute('aria-label'),disabled:x.disabled})).slice(0,40)}})()`);
    assert(selectionAttempt.clicked, `No se pudo seleccionar variante real ${expectedVariantLabel}: ${JSON.stringify(selectionAttempt)}`);
    await wait(`document.body.innerText.includes('$${expectedFrontendPrice.toLocaleString('es-CL')}')`, 10_000, 'precio de variante seleccionada');
  }
  const detail = await evaluate(`(()=>({h1:document.querySelector('h1')?.innerText||'',body:document.body.innerText,images:[...document.images].map(i=>({src:i.src,broken:i.complete&&!i.naturalWidth})),selected:[...document.querySelectorAll('button[aria-pressed="true"]')].map(n=>n.getAttribute('aria-label')),add:[...document.querySelectorAll('button')].some(n=>n.textContent.includes('Agregar al carrito'))}))()`);
  assert(detail.h1.length > 0, 'Product detail sin nombre');
  assert(detail.images.some((image) => !image.broken), 'Product detail sin imagen válida');
  assert(detail.add, 'Product detail sin CTA agregar');
  assert(detail.body.includes(`$${expectedFrontendPrice.toLocaleString('es-CL')}`), `Precio visible ${expectedFrontendPrice} no coincide`);
  if (variant) assert(detail.selected.some((label) => label?.includes(expectedVariantLabel)), `Variante ${expectedVariantLabel} no quedó seleccionada`);
  results.product = 'PASS';

  await clickText('Agregar al carrito', 'button');
  await wait(`JSON.parse(localStorage.getItem('yesyes-cart')||'{"state":{"items":[]}}').state.items.length===1`, 10_000, 'item agregado por UI');
  await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/carrito' });
  await wait(`document.body.innerText.includes('Tu carrito') && document.body.innerText.includes('Resumen')`, 20_000, 'carrito abierto');
  const cartOne = await evaluate(`(()=>({body:document.body.innerText,items:JSON.parse(localStorage.getItem('yesyes-cart')).state.items}))()`);
  const item = cartOne.items[0];
  assert(item.productId === product.id, 'El carrito no contiene el producto real');
  assert(Boolean(variant) === Boolean(item.variantId) && (!variant || item.variantId === variant.id), 'La variante real no coincide');
  assert(item.quantity === 1, 'Cantidad inicial no es 1');
  assert(cartOne.body.includes('Subtotal') && cartOne.body.includes('Envío') && cartOne.body.includes('Total'), 'Resumen del carrito incompleto');
  results.cart = 'PASS';

  await evaluate(`(()=>{const n=document.querySelector('button[aria-label="Aumentar cantidad"]');if(!n)return false;n.click();return true})()`);
  await wait(`JSON.parse(localStorage.getItem('yesyes-cart')).state.items[0].quantity===2 && document.body.innerText.includes('$'+(${(expectedPrice*2).toLocaleString('es-CL')}))`, 10_000, 'cantidad 2 visible');
  await evaluate(`(()=>{const n=document.querySelector('button[aria-label^="Eliminar "]');if(!n)return false;n.click();return true})()`);
  await wait(`document.body.innerText.includes('Tu carrito está vacío')`, 10_000, 'carrito vacío tras eliminar');
  await client.send('Page.navigate', { url: `http://127.0.0.1:5173/productos/${encodeURIComponent(product.slug)}` });
  await wait(`document.body.innerText.includes('Agregar al carrito')`, 20_000, 'producto para readd');
  if (variant) {
    const reselected = await evaluate(`(()=>{const value=${JSON.stringify(expectedVariantLabel)};const n=[...document.querySelectorAll('button')].find(x=>!x.disabled&&(x.textContent||'').trim()===value);if(!n)return false;n.click();return true})()`);
    assert(reselected, `No se pudo reseleccionar variante ${expectedVariantLabel} tras readd`);
    await wait(`document.body.innerText.includes('$${expectedFrontendPrice.toLocaleString('es-CL')}')`, 10_000, 'precio variante readd');
  }
  await clickText('Agregar al carrito', 'button');
  await wait(`JSON.parse(localStorage.getItem('yesyes-cart')).state.items.length===1`, 10_000, 'producto readd');
  await client.send('Page.reload', { ignoreCache: true });
  await wait(`document.body.innerText.includes('Agregar al carrito')`, 20_000, 'producto tras refresh');
  await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/carrito' });
  await wait(`document.body.innerText.includes('Resumen') && JSON.parse(localStorage.getItem('yesyes-cart')).state.items.length===1`, 20_000, 'carrito persistido');
  const persistedItem = await evaluate(`JSON.parse(localStorage.getItem('yesyes-cart')).state.items[0]`);
  assert(persistedItem.productId === product.id && persistedItem.variantId === (variant?.id || null) && persistedItem.price === expectedFrontendPrice, `Persistencia cambió producto/variante/precio: ${JSON.stringify(persistedItem)}`);
  results.persistence = 'PASS';

  await clickText('Ir a pagar', 'button');
  await wait(`document.body.innerText.includes('Datos de envío') && document.body.innerText.includes('Resumen del pedido') && document.body.innerText.includes('Pagar con Mercado Pago')`, 20_000, 'checkout visible');
  const checkoutView = await evaluate(`(()=>({body:document.body.innerText,item:JSON.parse(localStorage.getItem('yesyes-cart')).state.items[0]}))()`);
  assert(checkoutView.item.productId === product.id, 'Checkout perdió el producto real');
  assert(checkoutView.body.includes('Subtotal') && checkoutView.body.includes('Envío') && checkoutView.body.includes('Total'), 'Checkout sin totales visibles');
  for (const [label, value] of [['Nombre completo', 'QA Browser'], ['Email', 'qa-browser@example.invalid'], ['Teléfono', '912345678'], ['Dirección', 'QA 123'], ['Ciudad', 'Santiago'], ['Código Postal', '8340000']]) {
    const filled = await evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(n=>n.innerText.trim()===${JSON.stringify(label)});const n=l?.parentElement?.querySelector('input');if(!n)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    assert(filled, `No se pudo completar ${label}`);
  }
  results.checkout = 'PASS';

  const trusted = trustedCheckout([{ productId: product.id, variantId: variant?.id || null, quantity: 1 }]);
  assert(trusted.lines.length === 1 && trusted.lines[0].productId === product.id, 'Backend no resolvió producto real');
  assert(Boolean(trusted.lines[0].variantId) === Boolean(variant) && (!variant || trusted.lines[0].variantId === variant.id), 'Backend no resolvió variante real');
  assert(trusted.lines[0].quantity === 1 && trusted.lines[0].stock >= 1, 'Backend no validó cantidad/stock');
  assert(trusted.lines[0].unitPrice === expectedPrice && trusted.subtotal === expectedPrice && trusted.shipping === (expectedPrice >= 50000 ? 0 : 4990) && trusted.total === trusted.subtotal + trusted.shipping, 'Backend no recalculó subtotal/shipping/total');
  const tampered = await evaluate(`(()=>{const key='yesyes-cart';const data=JSON.parse(localStorage.getItem(key));const original=data.state.items[0].price;data.state.items[0].price=1;data.state.items[0].providerPrice=1;localStorage.setItem(key,JSON.stringify(data));data.state.items[0].price=original;return {tampered:1,original}})()`);
  assert(tampered.tampered === 1, 'No se pudo alterar visualmente el precio QA');
  await evaluate(`localStorage.setItem('yesyes-cart', ${JSON.stringify(JSON.stringify({ state: { items: [item] }, version: 0 }))})`);
  const trustedAfterTamper = trustedCheckout([{ productId: product.id, variantId: variant?.id || null, quantity: 1 }]);
  assert(trustedAfterTamper.lines[0].unitPrice === expectedPrice && trustedAfterTamper.total === trusted.total, 'Backend confió en precio manipulado');
  results.backendAuthority = 'PASS';
  results.cartItem = item;
  return results;
}


