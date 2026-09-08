/** Diagnóstico puntual: cuenta productos/órdenes/orderItems en la BD. */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const [products, byStatus, orders, orderItems, users] = await Promise.all([
    prisma.product.count(),
    prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.user.count(),
  ]);
  console.log({ products, byStatus, orders, orderItems, users });
  const sample = await prisma.product.findMany({ take: 3, select: { id: true, name: true, status: true, salePrice: true } });
  console.log('Muestra de productos:', JSON.stringify(sample, null, 2));
}

main()
  .catch((e) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());