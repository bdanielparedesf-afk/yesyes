import { useEffect, useState } from 'react';
import { Check, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
import { getPublicBusinessPlan, startBusinessCheckout } from '@/services/business';

/**
 * COBRO DE LA PUBLICACION.
 *
 * QUE RESUELVE: al presionar "Publicar" sin suscripcion, el backend devolvia
 * 409 y el editor pintaba una frase cruda ("Necesitas una suscripción activa
 * para publicar tu página...") sin decir CUANTO cuesta ni COMO pagar. El
 * dueño quedaba sin salida: el unico camino era cerrar el editor, con la
 * pagina ya hecha.
 *
 * COPY: el precio se formatea como "$11.990" (punto de miles, como se escribe
 * un precio en Chile) y se explicita que es POR PAGINA. Se dice tambien que el
 * pago lo procesa Mercado Pago y que se puede cancelar: un cobro recurrente
 * Sorprendido es la peor forma de perder a un cliente pequeño.
 *
 * El monto NUNCA se escribe en este archivo: se pide al backend
 * (`GET /public/businesses/plans`). Si el precio cambia, el modal lo refleja
 * sin tocar codigo y sin que el cliente pueda decidir cuanto paga.
 */

const precio = (amount: number) => `$${new Intl.NumberFormat('es-CL').format(amount)}`;

export default function PublishPaymentDialog({ businessId, onClose, onPaid, motivo = 'publicar' }: {
  businessId: string;
  onClose: () => void;
  /** Se dispara cuando el dueño vuelve del pago y ya puede publicar. */
  onPaid?: () => void;
  /**
   * `publicar` = nunca se publicó. `regularizar` = la página ya estaba en
   * línea y se cayó por el cobro. El precio es el mismo, pero el encabezado
   * NO puede decir "tu página está lista" a alguien que ya la tenía publicada
   * hace un mes: le haría creer que su trabajo se perdió.
   */
  motivo?: 'publicar' | 'regularizar';
}) {
  const [plan, setPlan] = useState<{ name: string; amount: number; features: string[]; frequency: number; frequencyType: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getPublicBusinessPlan()
      .then((found) => { if (alive) setPlan(found); })
      .catch(() => { if (alive) setError('No pudimos cargar el precio. Recarga la página e inténtalo de nuevo.'); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, []);

  // Al volver de la pestaña de Mercado Pago, el dueño no debe tener que
  // adivinar si pago: se reintenta la publicacion una sola vez.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible' && onPaid) onPaid(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [onPaid]);

  const pagar = async () => {
    setPaying(true); setError('');
    try {
      const { checkoutUrl } = await startBusinessCheckout(businessId);
      // Abre la preferencia REAL creada por el backend, no una simulación.
      window.location.assign(checkoutUrl);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No pudimos abrir el pago. Inténtalo de nuevo en unos segundos.');
      setPaying(false);
    }
  };

  const mensual = plan?.frequencyType === 'MONTH';
  const regularizando = motivo === 'regularizar';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pay-title" data-testid="publish-payment-dialog">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pay-title" className="text-xl font-bold text-stone-900">
              {regularizando ? 'Volver a publicar tu página' : 'Tu página está lista'}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {regularizando
                ? 'Todo sigue guardado tal como lo dejaste. Al regularizar, tu página vuelve a estar en línea.'
                : 'Solo falta activarla. Tus cambios ya están guardados: no vas a perder nada.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl border px-3 py-1.5 text-sm">Cerrar</button>
        </div>

        {loading && <p className="mt-6 text-sm text-stone-500">Cargando el precio…</p>}

        {plan && (
          <>
            <div className="mt-5 rounded-2xl border-2 border-stone-900 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{plan.name}</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-stone-900" data-testid="plan-price">
                {precio(plan.amount)}
              </p>
              <p className="mt-1 text-sm text-stone-600">{mensual ? 'por página, al mes' : 'por página'}</p>
              {plan.features?.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-stone-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

            <button
              type="button"
              onClick={pagar}
              disabled={paying}
              data-testid="pay-button"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 p-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {paying ? <><Loader2 className="h-4 w-4 animate-spin" /> Abriendo el pago…</> : <>Pagar {precio(plan.amount)} <ExternalLink className="h-4 w-4" /></>}
            </button>

            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-stone-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Pagas con Mercado Pago, de forma segura. {mensual
                ? 'Es una suscripción mensual de tu página: puedes cancelarla cuando quieras desde tu panel.'
                : 'Puedes cancelar tu plan desde el panel.'}
            </p>
          </>
        )}

        {!loading && !plan && !error && (
          <p className="mt-6 text-sm text-stone-600">El plan no está disponible en este momento. Inténtalo más tarde.</p>
        )}
      </div>
    </div>
  );
}
