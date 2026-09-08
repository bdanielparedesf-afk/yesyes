/** Lista las últimas órdenes para verificar el flujo de pago. */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const orders = await prisma.order.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      userId: true,
      total: true,
      shipping: true,
      status: true,
      orderItems: { select: { productName: true, quantity: true } },
    },
  });
  for (const o of orders) {
    const items = o.orderItems.map((i) => `${i.productName} x${i.quantity}`).join(', ');
    console.log(
      `${o.orderNumber} | user: ${o.userId ?? 'GUEST'} | total: ${o.total} | envio: ${o.shipping} | ${o.status} | ${items}`
    );
  }
  const rescued = await prisma.product.count({ where: { importSource: 'CART_RECOVERY' } });
  console.log(`Productos rescatados (DRAFT): ${rescued}`);
}

main()
  .catch((e) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());