import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.business.findUnique({ where: { slug: 'clinica-veterinaria-los-robles-14' }, select: { id: true, category: true } });
  const inst = await prisma.businessSiteInstance.findUnique({ where: { businessId: b!.id }, select: { id: true, manifest: true, updatedAt: true, manifestVersion: true } });
  if (!inst) { console.log('SIN INSTANCIA'); return; }
  const m: any = inst.manifest;
  console.log('categoria:', b!.category);
  console.log('manifestVersion:', inst.manifestVersion, 'legacy:', m.legacy, 'layout:', m.layout);
  console.log('sections:', (m.sections || []).map((s: any) => `${s.id}|order=${s.order}|hidden=${!!s.hidden}|${(s.blocks||[]).map((x:any)=>x.block+':'+x.instanceId+':'+JSON.stringify(x.config||{})).join(',')}`).join('\n          '));
  const revs = await prisma.businessSiteRevision.findMany({ where: { instanceId: inst.id }, orderBy: { createdAt: 'desc' }, take: 3, select: { reason: true, createdAt: true } });
  console.log('revisiones:', JSON.stringify(revs, null, 1));
}
main().finally(() => prisma.$disconnect());
