import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CreditCard } from 'lucide-react';
import { getBusinessPageStatus, type BusinessPageStatus } from '@/services/business';
import PublishPaymentDialog from './PublishPaymentDialog';
import { pageStatusCopy } from './page-status-copy';

/**
 * AVISO DE PAGINA CAIDA, para el dueño.
 *
 * POR QUE EXISTE: cuando la suscripcion vencía, la página pasaba a 404 pero el
 * dueño entraba a su panel y veía todo "normal". Sin explicacion, su primera
 * conclusion es que la plataforma esta rota, y cuando le arreglamos el pago
 * queda con una mala impresion dificil de borrar. Un dueno que regulariza solo
 * cuando entiende el motivo recupera el ingreso; uno que cree que hubo una
 * falla se va y no vuelve.
 *
 * El tono es el de un cobro, NO el de una multa: se dice que paso, cuanto
 * cuesta volver a levantarla y que su contenido quedo intacto. Nunca se
 * amenaza ni se culpa: el dueno no hizo nada malo, se le paso el cobro.
 *
 * Solo se muestra si la pagina NO esta en linea. Con la gracia vigente sale un
 * aviso suave con los dias que faltan, no el banner completo.
 */
export default function PageStatusBanner({ businessId, onPaid }: { businessId: string; onPaid?: () => void }) {
  const [status, setStatus] = useState<BusinessPageStatus | null>(null);
  const [abriendoPago, setAbriendoPago] = useState(false);

  const load = useCallback(() => {
    getBusinessPageStatus(businessId)
      .then(setStatus)
      // Si falla, no se molesta al dueño con un aviso: si el backend no
      // responde, el más probable es un problema de red, no una baja real.
      .catch(() => setStatus(null))
      // Tras volver de Mercado Pago se recarga: si entró el pago, el banner
      // desaparece solo y el dueño no tiene que recargar a mano.
      .finally(() => onPaid?.());
  }, [businessId, onPaid]);

  useEffect(() => {
    if (!businessId) return;
    load();
    // Se refresca al volver de la pestana de Mercado Pago.
    const alVolver = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [businessId, load]);

  // Toda la decisión de qué se dice y con qué tono vive en `pageStatusCopy`,
  // que es pura y está cubierta por tests. Acá solo se pinta.
  // El alias `s` existe para que TS estreche el tipo: narrowear `status`
  // (estado de React) a través de llamadas no funciona.
  const s = status;
  const copy = pageStatusCopy(s);
  if (!copy || !s) return null;

  const aviso = copy.tono === 'aviso';
  const enGracia = copy.accion === 'pagar' && s.reason === 'GRACE_ACTIVE';

  const estilos = aviso
    ? { contenedor: 'border-amber-200 bg-amber-50', icono: 'text-amber-700', titulo: 'text-amber-900', cuerpo: 'text-amber-900' }
    : copy.tono === 'info'
      ? { contenedor: 'border-stone-200 bg-stone-50', icono: 'text-stone-500', titulo: 'text-stone-900', cuerpo: 'text-stone-700' }
      : { contenedor: 'border-rose-200 bg-rose-50', icono: 'text-rose-700', titulo: 'text-rose-900', cuerpo: 'text-rose-800' };

  return (
    <>
      <div
        role="status"
        data-testid="page-status-banner"
        className={`flex flex-wrap items-start gap-3 border-b px-4 py-3 ${estilos.contenedor}`}
      >
        {aviso
          ? <CalendarClock className={`mt-0.5 h-5 w-5 shrink-0 ${estilos.icono}`} />
          : <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${estilos.icono}`} />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${estilos.titulo}`}>{copy.titulo}</p>
          <p className={`mt-1 text-sm leading-5 ${estilos.cuerpo}`}>{copy.cuerpo}</p>
          {s.graceUntil && enGracia && (
            <p className="mt-1 text-xs text-amber-800">
              Vence el {new Date(s.graceUntil).toLocaleDateString('es-CL', { day: '2-digit', month: 'long' })}.
            </p>
          )}
        </div>
        {copy.accion === 'pagar' && (
          <button
            type="button"
            data-testid="page-status-pay"
            onClick={() => setAbriendoPago(true)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white ${
              aviso ? 'bg-amber-700 hover:bg-amber-800' : 'bg-rose-700 hover:bg-rose-800'
            }`}
          >
            <CreditCard className="h-4 w-4" /> Regularizar
          </button>
        )}
        {copy.accion === 'reactivar' && (
          <a href="/negocio/configuracion" className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800">
            Reactivar
          </a>
        )}
      </div>
      {abriendoPago && (
        <PublishPaymentDialog
          businessId={businessId}
          motivo="regularizar"
          onClose={() => setAbriendoPago(false)}
          onPaid={load}
        />
      )}
    </>
  );
}
