/**
 * TEXTO DEL AVISO DE ESTADO, separado del componente.
 *
 * POR QUE ESTA EN SU PROPIO ARCHIVO: esta es la parte que un dueño LEE. Si la
 * lógica vive metida en el JSX no se puede probar sin montar React, y es
 * justamente el copy el que más se rompe (ya pasó: se sirvio sin acentos y
 * con "dias de grace"). Aquí se decide, en una función pura, qué se muestra y
 * con qué tono, y eso queda cubierto por tests.
 */

export type PageStatusReason =
  | 'OK' | 'GRACE_ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'NO_SUBSCRIPTION' | 'NOT_PUBLISHABLE';

export interface PageStatusLike {
  live: boolean;
  reason: PageStatusReason;
  businessStatus: string;
  subscriptionStatus: string | null;
  graceDaysLeft: number;
  graceUntil: string | null;
}

export type PageStatusTone = 'info' | 'aviso' | 'error';

export interface PageStatusCopy {
  titulo: string;
  cuerpo: string;
  /** `aviso` = todavía se puede arreglar; `error` = ya se cayó. */
  tono: PageStatusTone;
  /** Que acción offercer: pagar, reactivar o ninguna. */
  accion: 'pagar' | 'reactivar' | 'ninguna';
}

/**
 * QUE DEVUELVE null ES JUSTO LO IMPORTANTE.
 *
 * El peor error posible de este banner es mentir. Se calla cuando:
 *  - no hay nada que avisar (todo en orden);
 *  - la página es un borrador que nunca se publicó: un dueño armando su
 *    página por primera vez NO tiene por qué ver "dada de baja";
 *  - la pausa la pidió un admin y no el dueño: no es un cobro fallido.
 * Y se muestra la GRACIA aun estando en línea, que es el único momento en que
 * el aviso todavía sirve para algo.
 */
export function pageStatusCopy(s: PageStatusLike | null): PageStatusCopy | null {
  if (!s) return null;

  const enGracia = s.reason === 'GRACE_ACTIVE';
  if (s.live && !enGracia) return null;
  if (s.reason === 'NOT_PUBLISHABLE' || s.businessStatus === 'DRAFT') return null;

  // El backend mapea PAUSED y el impago al mismo motivo, así que se usa el
  // estado real de la suscripción: acusar un cobro fallido que no ocurrió
  // hace que el dueño llame a soporte furious por algo que no es un error.
  const pausada = s.subscriptionStatus === 'PAUSED';
  const cancelada = s.reason === 'CANCELLED';
  const sinPlan = s.reason === 'NO_SUBSCRIPTION';

  if (pausada) {
    return {
      titulo: 'Tu página está pausada',
      cuerpo: 'Tu plan está pausado, así que tu página no aparece en Google ni en las búsquedas de YesYes. Todo tu contenido sigue guardado.',
      tono: 'aviso',
      accion: 'reactivar',
    };
  }
  if (cancelada) {
    return {
      titulo: 'Tu página está en pausa',
      cuerpo: 'La cancelaste o terminó tu plan. Todo tu contenido sigue guardado; cuando quieras volver, reactívala y tu página reaparece tal como la dejaste.',
      tono: 'info',
      accion: 'reactivar',
    };
  }
  if (sinPlan) {
    return {
      titulo: 'Tu página aún no tiene un plan activo',
      cuerpo: 'Cuando actives tu plan, la página vuelve a estar visible con todo lo que ya cargaste.',
      tono: 'info',
      accion: 'ninguna',
    };
  }
  if (enGracia) {
    const d = s.graceDaysLeft;
    return {
      titulo: `Tu página sigue en línea: te quedan ${d} ${d === 1 ? 'día' : 'días'}`,
      cuerpo: 'No pudimos renovar tu pago. Regulariza antes de que terminen los días de gracia y no tendrás que hacer nada más.',
      tono: 'aviso',
      accion: 'pagar',
    };
  }
  return {
    titulo: 'Tu página fue dada de baja',
    cuerpo: 'No pudimos cobrar tu plan, se cumplieron los días de gracia y la página se sacó de línea. Todo lo que subiste sigue guardado: si regularizas, vuelve exactamente como la dejaste.',
    tono: 'error',
    accion: 'pagar',
  };
}
