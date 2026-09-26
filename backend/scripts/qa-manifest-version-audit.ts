/** READ-ONLY: interpretacion de `manifestVersion` en la pagina real de Veterinaria. */
import { PrismaClient } from '@prisma/client';
import { CURRENT_MANIFEST_VERSION, checkManifestCompatibility } from '../src/template-engine/template-manifest';
import { requiresLegacyRenderer } from '../src/template-engine/site-instance';

const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findUnique({
    where: { slug: 'clinica-veterinaria-los-robles-14' },
    include: { siteInstance: true, template: { select: { code: true, legacy: true } } },
  });
  const instance = business?.siteInstance;
  if (!instance) { console.log('sin instancia'); return; }
  const manifest = instance.manifest as Record<string, unknown>;
  console.log(JSON.stringify({
    templateLegacyV3: business!.template?.legacy,
    legacyCompatibilityEnInstancia: instance.legacyCompatibility,
    manifestLegacyFlag: manifest.legacy,
    rendererUsaViaLegacy: requiresLegacyRenderer(manifest),
    manifestVersionGuardado: instance.manifestVersion,
    manifestVersionEnElJson: manifest.manifestVersion,
    CURRENT_MANIFEST_VERSION,
    compatibilidad: checkManifestCompatibility(manifest),
    claves: Object.keys(manifest).sort(),
    secciones: Array.isArray(manifest.sections) ? manifest.sections.length : null,
  }, null, 1));
}

main().finally(() => prisma.$disconnect());
