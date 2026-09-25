import { resolveTrustedCheckout } from '../backend/src/services/checkout-pricing.service';
import { prisma } from '../backend/src/lib/prisma';

async function main() {
  try {
    const raw = JSON.parse(process.argv[2] || '{"items":[]}');
    const checkout = await resolveTrustedCheckout(raw.items);
    console.log(JSON.stringify(checkout));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
