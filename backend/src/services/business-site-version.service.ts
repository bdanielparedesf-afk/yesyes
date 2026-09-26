import { prisma } from '../lib/prisma';
import { cloneManifest } from '../template-engine/site-instance';
import { CURRENT_MANIFEST_VERSION } from '../template-engine/template-manifest';

/**
 * YESYES BUSINESS — CONTRATO DRAFT vs PUBLISHED (Fase 3).
 *
 * Fuentes de verdad, sin ambigüedad:
 *
 *   DRAFT      → `BusinessSiteInstance.manifest` (mutable, una sola por negocio)
 *   PUBLISHED  → la última revisión CONGELADA, identificada por un estado
 *                explícito, nunca por el texto libre del motivo.
 *   HISTORIAL  → `BusinessSiteRevision` append-only (nunca se actualiza).
 *
 * La página pública NUNCA lee el borrador. El preview SÍ lo lee: es lo que la
 * persona está probando. Publicar es una operación explícita DRAFT → PUBLISHED
 * que congela una COPIA del borrador en una revisión nueva.
 *
 * REGLA DE ORO: el motivo de una revisión lo escribe el backend. Un `reason`
 * enviado por el cliente NUNCA puede convertirse en el estado de publicación;
 * si lo pudiera, editar el borrador publicaría la página sin pasar por el gate
 * de pago.
 */

/** Prefijo histórico. Se conserva para leer datos ya publicados antes de Fase 3. */
export const LEGACY_PUBLISHED_PREFIX = 'PUBLICADO';

/** Razón canónica de una revisión congelada como versión publicada. */
export function publishedRevisionReason(at: Date = new Date()): string {
  return `PUBLICADO ${at.toISOString()}`;
}

/**
 * ¿Este motivo representa una versión publicada?
 *
 * Acepta el prefijo histórico (`PUBLICADO ...`) porque hay revisiones ya
 * escritas en la base, y la razón canónica nueva. Los motivos que llegan desde
 * el cliente pasan antes por `sanitizeRevisionReason`, que impide colarse aquí.
 */
export function isPublishedRevisionReason(reason: unknown): boolean {
  const value = String(reason || '');
  return value === 'PUBLICADO' || value.startsWith(`${LEGACY_PUBLISHED_PREFIX} `);
}

/**
 * Neutraliza el intento de un cliente de fabricar una publicación por el motivo.
 *
 * `PUT /manifest` y `PUT /site-instance` aceptan `reason` del cliente. Si ese
 * texto llegara intacto a la revisión, un guardado normal del editor publicaría
 * la página sin pagar. Aquí se reescribe cualquier motivo que parezca una
 * publicación, sin cambiar el significado real de la edición.
 */
export function sanitizeRevisionReason(reason: unknown, fallback = 'actualizacion del negocio'): string {
  const raw = String(reason ?? '').trim();
  if (!raw) return fallback;
  // Se conserva el texto, pero sin el prefijo reservado: sigue siendo legible
  // en el historial y ya no puede ser tomado como publicación.
  if (raw === LEGACY_PUBLISHED_PREFIX) return fallback;
  if (raw.toUpperCase().startsWith(LEGACY_PUBLISHED_PREFIX)) {
    return `BORRADOR${raw.slice(LEGACY_PUBLISHED_PREFIX.length)}`.slice(0, 200);
  }
  return raw.slice(0, 200);
}

/** Copia profunda: la versión publicada nunca comparte objetos con el borrador. */
function detached(manifest: unknown): unknown {
  return manifest === null || manifest === undefined
    ? manifest
    : JSON.parse(JSON.stringify(manifest));
}

export interface PublishedRevision {
  id: string;
  manifestVersion: number;
  manifest: unknown;
  reason: string;
  createdAt: Date;
}

/**
 * Última revisión PUBLICADA de una instancia. Es la ÚNICA fuente válida para
 * la página pública. Si no existe, la página pública no renderiza manifest V2
 * (y cae en la vía legacy, que es lo correcto: aún no se publicó este diseño).
 */
export async function latestPublishedRevision(instanceId: string | null | undefined): Promise<PublishedRevision | null> {
  if (!instanceId) return null;
  const revisions = await prisma.businessSiteRevision.findMany({
    where: { instanceId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, manifestVersion: true, manifest: true, reason: true, createdAt: true },
  });
  const found = revisions.find((revision) => isPublishedRevisionReason(revision.reason));
  return (found as PublishedRevision) || null;
}

/** Manifest publicado, o `null` si el sitio nunca se publicó. */
export async function publishedManifestOf(instanceId: string | null | undefined): Promise<unknown | null> {
  const revision = await latestPublishedRevision(instanceId);
  return revision ? detached(revision.manifest) : null;
}

/**
 * DRAFT → PUBLISHED explícito.
 *
 * Congela el borrador actual en una revisión nueva e inmutable. Idempotente:
 * si el borrador no cambió desde la última publicación, no crea una revisión
 * repetida. NUNCA modifica revisiones anteriores.
 */
export async function freezeDraftAsPublished(params: {
  businessId: string;
  at?: Date;
}): Promise<{ frozen: boolean; revisionId: string | null; instanceId: string | null }> {
  const instance = await prisma.businessSiteInstance.findUnique({
    where: { businessId: params.businessId },
    select: { id: true, manifest: true, manifestVersion: true },
  });
  if (!instance) return { frozen: false, revisionId: null, instanceId: null };

  const current = await latestPublishedRevision(instance.id);
  const sameAsPublished = JSON.stringify(current?.manifest ?? null) === JSON.stringify(instance.manifest);
  if (sameAsPublished && current) {
    return { frozen: false, revisionId: current.id, instanceId: instance.id };
  }

  const at = params.at || new Date();
  const created = await prisma.businessSiteRevision.create({
    data: {
      id: `rev-${params.businessId}-pub-${at.getTime()}`,
      instanceId: instance.id,
      manifestVersion: instance.manifestVersion || CURRENT_MANIFEST_VERSION,
      // Copia real: aunque el borrador siga mutando en el editor, la versión
      // publicada queda congelada en su propio árbol de objetos.
      manifest: detached(instance.manifest) as any,
      reason: publishedRevisionReason(at),
    },
    select: { id: true },
  });
  return { frozen: true, revisionId: created.id, instanceId: instance.id };
}

export { cloneManifest };
