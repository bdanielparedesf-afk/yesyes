/**
 * READ-ONLY. Imprime el estado real de draft / published / revisions de un
 * negocio para auditar la separacion V2. Nunca escribe nada.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const slug = process.argv[2] || 'clinica-veterinaria-los-robles-14';

function fp(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}
function title(manifest: any): string | null {
  const hero = manifest?.sections?.find((s: any) => (s.blocks || []).some((b: any) => String(b.block).startsWith('Hero')));
  const block = hero?.blocks?.find((b: any) => String(b.block).startsWith('Hero'));
  const nav = manifest?.sections?.flatMap((s: any) => s.blocks || []).find((b: any) => String(b.block).startsWith('Cta')) as any;
  return {
    hero: block?.config?.title ?? null,
    cta: nav?.config?.label ?? null,
    sections: (manifest?.sections || []).map((s: any) => s.id).join(','),
  } as any;
}

async function main() {
  const business = await prisma.business.findUnique({
    where: { slug },
    include: { template: { select: { id: true, code: true, legacy: true } }, siteInstance: true, subscription: true },
  });
  if (!business) { console.log('NO EXISTE', slug); return; }
  console.log('=== BUSINESS ===');
  console.log({ id: business.id, slug: business.slug, status: business.status, category: business.category, publishedAt: business.publishedAt, template: business.template, subscription: business.subscription ? { status: business.subscription.status, currentPeriodEnd: business.subscription.currentPeriodEnd } : null });

  const inst = business.siteInstance;
  console.log('=== INSTANCE (DRAFT) ===');
  console.log(inst ? { id: inst.id, manifestVersion: inst.manifestVersion, legacyCompatibility: inst.legacyCompatibility, updatedAt: inst.updatedAt, fingerprint: fp(inst.manifest), content: title(inst.manifest) } : null);

  const revisions = inst ? await prisma.businessSiteRevision.findMany({ where: { instanceId: inst.id }, orderBy: { createdAt: 'asc' } }) : [];
  console.log('=== REVISIONS (' + revisions.length + ') ===');
  for (const r of revisions) {
    console.log({ id: r.id, createdAt: r.createdAt, reason: r.reason, manifestVersion: r.manifestVersion, fingerprint: fp(r.manifest), content: title(r.manifest) });
  }
}

main().finally(() => prisma.$disconnect());
