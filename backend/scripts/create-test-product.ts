/** Crea un producto de prueba publicado para poder testear el checkout completo.
 *  Elimínalo desde el panel admin (Productos) cuando quieras.
 *  Uso (desde /backend):  npx tsx scripts/create-test-product.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const SVG_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#eef2ff"/><text x="50%" y="46%" font-family="Arial" font-size="42" fill="#6366f1" text-anchor="middle">YESYES</text><text x="50%" y="58%" font-family="Arial" font-size="26" fill="#818cf8" text-anchor="middle">Producto de prueba</text></svg>`
  );

async function main() {
  const category =
    (await prisma.category.findUnique({ where: { slug: 'general' } })) ??
    (await prisma.category.create({ data: { name: 'General', slug: 'general' } }));

  const collection =
    (await prisma.collection.findUnique({ where: { slug: 'ofertas' } })) ??
    (await prisma.collection.create({ data: { name: 'Ofertas', slug: 'ofertas' } }));

  const existing = await prisma.product.findFirst({ where: { importSource: 'TEST' } });
  if (existing) {
    console.log(`Ya existe un producto de prueba: ${existing.id} (${existing.name})`);
    return;
  }

  const product = await prisma.product.create({
    data: {
      name: 'Producto de prueba (eliminable)',
      slug: `producto-de-prueba-${Date.now()}`,
      description:
        'Producto creado solo para probar el flujo de pago con Mercado Pago. Puedes eliminarlo desde el panel de administración.',
      images: [SVG_IMG],
      tags: ['prueba'],
      categoryId: category.id,
      collectionId: collection.id,
      salePrice: 4990,
      productCost: 2000,
      totalCost: 2000,
      margin: 60,
      stock: 100,
      variants: [],
      status: 'PUBLISHED',
      importSource: 'TEST',
      productImages: { create: [{ url: SVG_IMG, position: 0 }] },
    },
    select: { id: true, name: true, slug: true, salePrice: true },
  });

  console.log('Producto de prueba creado:', JSON.stringify(product));
}

main()
  .catch((e) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());