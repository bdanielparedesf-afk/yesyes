import { useCallback, useEffect, useState } from 'react';
import { getBusinessLeads, getBusinessStats } from '@/services/business';

const TYPE_LABEL: Record<string, string> = {
  RESERVA: 'Reserva',
  COTIZACION: 'Cotización',
  CONSULTA: 'Consulta',
  PEDIDO: 'Pedido',
  PROPERTY_INQUIRY: 'Propiedad',
};

const STAT_LABEL: { key: string; label: string }[] = [
  { key: 'pageViews', label: 'Visitas' },
  { key: 'waClicks', label: 'Clicks WhatsApp' },
  { key: 'phoneClicks', label: 'Clicks teléfono' },
  { key: 'emailClicks', label: 'Clicks email' },
  { key: 'leads', label: 'Leads' },
  { key: 'propertyViews', label: 'Vistas propiedad' },
];

/** Leads recibidos + totales de analytics (BusinessStatDaily). */
export default function LeadsSection({ businessId }: { businessId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([getBusinessLeads(businessId), getBusinessStats(businessId)]);
      setLeads(l);
      setTotals(s.totals as unknown as Record<string, number>);
    } catch {
      setMsg('Error cargando leads');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Leads y analytics</h2>
      {msg && <p className="text-sm text-neutral-600">{msg}</p>}

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STAT_LABEL.map((s) => (
            <div key={s.key} className="bg-white border rounded-xl p-3 text-center">
              <p className="text-xl font-bold">{totals[s.key] ?? 0}</p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 bg-neutral-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !leads.length ? (
        <p className="bg-white border rounded-xl p-6 text-sm text-neutral-500 text-center">
          Aún no has recibido leads. Comparte tu página para empezar a recibir consultas.
        </p>
      ) : (
        <ul className="space-y-2">
          {leads.map((l) => (
            <li key={l.id} className="bg-white border rounded-xl p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold bg-neutral-100 rounded-full px-2 py-0.5">
                    {TYPE_LABEL[l.type] || l.type}
                  </span>
                  <span className="font-semibold">{l.name || 'Sin nombre'}</span>
                  {l.waClick && <span className="text-xs text-green-700">WhatsApp clicado</span>}
                </div>
                <span className="text-xs text-neutral-400">{new Date(l.createdAt).toLocaleString('es-CL')}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-neutral-600 mt-1">
                {l.phone && <a className="underline" href={`tel:${l.phone}`}>{l.phone}</a>}
                {l.email && <a className="underline" href={`mailto:${l.email}`}>{l.email}</a>}
              </div>
              {l.message && <p className="text-sm text-neutral-700 mt-1 whitespace-pre-line">{l.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
